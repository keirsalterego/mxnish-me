---
title: "Deep Dive into Rust: Building DedCore, a High-Performance Deduplication Tool"
tags: ["Rust", "Performance", "Systems Programming", "CLI Tools"]
---

# Deep Dive into Rust: Building DedCore, a High-Performance Deduplication Tool

## Introduction

June 2025 was my "Rust deep dive" month. After months of contributing to Rust projects and reading about the language, I committed to building something substantial: **DedCore**, a smart file deduplication tool. This post chronicles the journey of building a production-ready CLI tool in Rust, covering everything from project structure to performance optimization.

## Why DedCore?

### The Problem

Modern storage is cheap, but that doesn't mean we should waste it. I had:

- 500GB+ of duplicate photos across backup drives
- Multiple downloads of the same files
- Old project directories with copied dependencies
- No easy way to identify what was actually duplicate

Existing tools were either:
- Too slow (scanning takes hours)
- Too simple (just compare file sizes)
- Too dangerous (auto-delete without verification)
- Not flexible (limited hash algorithms)

### The Solution: DedCore

A high-performance CLI tool that:
- Scans directories in parallel
- Uses multiple hashing algorithms (blake3, xxhash, sha256)
- Filters intelligently (by size, extension, age)
- Provides a TUI for safe review and deletion
- Never deletes without explicit confirmation

## Rust Learning Curve

### Week 1: Fighting the Borrow Checker

Every Rust developer's rite of passage:

```rust
// My first attempt - doesn't compile
fn scan_directory(path: &Path) -> Vec<File> {
    let mut files = Vec::new();
    
    for entry in fs::read_dir(path).unwrap() {
        let entry = entry.unwrap();
        let file = File::from(entry);
        
        // Error: cannot move out of `file` which is borrowed
        files.push(file);
        process_file(&file);  // ❌ file moved above
    }
    
    files
}

// After understanding ownership
fn scan_directory(path: &Path) -> Vec<File> {
    let mut files = Vec::new();
    
    for entry in fs::read_dir(path).unwrap() {
        let entry = entry.unwrap();
        let file = File::from(entry);
        
        process_file(&file);  // ✅ Borrow, don't move
        files.push(file);     // ✅ Now we can move
    }
    
    files
}
```

**Lesson**: The borrow checker is teaching you to write correct code. Embrace it.

### Week 2: Error Handling the Rust Way

Coming from Python/JavaScript, Rust's error handling was a revelation:

```rust
use anyhow::{Context, Result};
use std::fs::File;
use std::io::Read;

// Before: Panic-driven development
fn read_file(path: &Path) -> String {
    let mut file = File::open(path).unwrap();  // ❌ Crashes on error
    let mut contents = String::new();
    file.read_to_string(&mut contents).unwrap();  // ❌ More crashes
    contents
}

// After: Proper error handling
fn read_file(path: &Path) -> Result<String> {
    let mut file = File::open(path)
        .context("Failed to open file")?;  // ✅ Propagate with context
    
    let mut contents = String::new();
    file.read_to_string(&mut contents)
        .context("Failed to read file contents")?;  // ✅ More context
    
    Ok(contents)
}

// Using it
match read_file(path) {
    Ok(contents) => println!("Read {} bytes", contents.len()),
    Err(e) => eprintln!("Error: {:#}", e),  // Prints full error chain
}
```

**Lesson**: `Result<T, E>` forces you to handle errors. The `?` operator makes it ergonomic.

### Week 3: Concurrency Without Fear

Rust's ownership system makes concurrent programming safe:

```rust
use rayon::prelude::*;
use std::sync::Arc;

// Parallel file scanning
fn scan_parallel(paths: Vec<PathBuf>) -> Vec<FileInfo> {
    paths
        .par_iter()  // Parallel iterator
        .filter_map(|path| {
            // Each thread gets its own work
            match analyze_file(path) {
                Ok(info) => Some(info),
                Err(e) => {
                    eprintln!("Error analyzing {:?}: {}", path, e);
                    None
                }
            }
        })
        .collect()
}

// Shared state with Arc (Atomic Reference Counting)
fn process_with_progress(files: Vec<PathBuf>) -> Result<Stats> {
    let progress = Arc::new(AtomicUsize::new(0));
    let total = files.len();
    
    let results: Vec<_> = files
        .par_iter()
        .map(|file| {
            let result = process_file(file);
            
            // Safe to share across threads
            let current = progress.fetch_add(1, Ordering::Relaxed);
            print_progress(current, total);
            
            result
        })
        .collect();
    
    Ok(combine_results(results))
}
```

**Lesson**: "Fearless concurrency" isn't marketing—the compiler prevents data races.

## Building DedCore: Architecture

### Project Structure

```
dedcore/
├── Cargo.toml              # Dependencies and metadata
├── src/
│   ├── main.rs            # CLI entry point
│   ├── lib.rs             # Library exports
│   ├── scanner/
│   │   ├── mod.rs         # Module definition
│   │   ├── walker.rs      # Directory traversal
│   │   └── filter.rs      # File filtering
│   ├── hasher/
│   │   ├── mod.rs
│   │   ├── blake3.rs      # blake3 hashing
│   │   ├── xxhash.rs      # xxhash implementation
│   │   └── sha256.rs      # sha256 fallback
│   ├── detector/
│   │   ├── mod.rs
│   │   └── duplicates.rs  # Duplicate detection logic
│   ├── tui/
│   │   ├── mod.rs
│   │   ├── app.rs         # TUI application state
│   │   └── widgets.rs     # Custom widgets
│   └── config.rs          # Configuration management
├── tests/
│   ├── integration/       # Integration tests
│   └── fixtures/          # Test data
└── benches/
    └── performance.rs     # Benchmarks
```

### Core Modules

#### 1. Scanner: Walking the Directory Tree

```rust
use walkdir::WalkDir;
use rayon::prelude::*;

pub struct Scanner {
    config: ScanConfig,
}

pub struct ScanConfig {
    pub min_size: u64,           // Ignore tiny files
    pub max_depth: Option<usize>, // Directory depth limit
    pub extensions: Option<Vec<String>>,
    pub exclude_patterns: Vec<String>,
}

impl Scanner {
    pub fn scan(&self, root: &Path) -> Result<Vec<FileEntry>> {
        // Parallel directory walk
        let entries: Vec<_> = WalkDir::new(root)
            .max_depth(self.config.max_depth.unwrap_or(usize::MAX))
            .into_iter()
            .par_bridge()  // Convert to parallel iterator
            .filter_map(|e| e.ok())
            .filter(|e| e.file_type().is_file())
            .filter(|e| self.should_include(e))
            .map(|e| FileEntry::from(e))
            .collect();
        
        Ok(entries)
    }
    
    fn should_include(&self, entry: &DirEntry) -> bool {
        // Size filter
        if let Ok(metadata) = entry.metadata() {
            if metadata.len() < self.config.min_size {
                return false;
            }
        }
        
        // Extension filter
        if let Some(ref exts) = self.config.extensions {
            if let Some(ext) = entry.path().extension() {
                if !exts.contains(&ext.to_string_lossy().to_string()) {
                    return false;
                }
            } else {
                return false;  // No extension
            }
        }
        
        // Exclude patterns
        let path = entry.path().to_string_lossy();
        for pattern in &self.config.exclude_patterns {
            if path.contains(pattern) {
                return false;
            }
        }
        
        true
    }
}
```

#### 2. Hasher: Fast Content Hashing

```rust
use blake3::Hasher as Blake3Hasher;
use std::fs::File;
use std::io::{BufReader, Read};

pub trait FileHasher {
    fn hash_file(&self, path: &Path) -> Result<Hash>;
}

pub struct Blake3HashImpl;

impl FileHasher for Blake3HashImpl {
    fn hash_file(&self, path: &Path) -> Result<Hash> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut hasher = Blake3Hasher::new();
        
        // Stream the file in chunks to avoid loading entire file into memory
        let mut buffer = [0u8; 8192];
        loop {
            let bytes_read = reader.read(&mut buffer)?;
            if bytes_read == 0 {
                break;
            }
            hasher.update(&buffer[..bytes_read]);
        }
        
        Ok(Hash::from(hasher.finalize().as_bytes()))
    }
}

// Parallel hashing with rayon
pub fn hash_files_parallel(
    files: Vec<PathBuf>,
    hasher: Arc<dyn FileHasher>,
) -> Vec<(PathBuf, Hash)> {
    files
        .par_iter()
        .filter_map(|path| {
            match hasher.hash_file(path) {
                Ok(hash) => Some((path.clone(), hash)),
                Err(e) => {
                    eprintln!("Failed to hash {:?}: {}", path, e);
                    None
                }
            }
        })
        .collect()
}
```

#### 3. Detector: Finding Duplicates

```rust
use std::collections::HashMap;

pub struct DuplicateDetector {
    files: Vec<FileInfo>,
}

#[derive(Debug)]
pub struct FileInfo {
    pub path: PathBuf,
    pub size: u64,
    pub hash: Hash,
}

#[derive(Debug)]
pub struct DuplicateGroup {
    pub hash: Hash,
    pub files: Vec<FileInfo>,
    pub total_size: u64,
    pub wasted_space: u64,  // (n-1) * file_size
}

impl DuplicateDetector {
    pub fn find_duplicates(&self) -> Vec<DuplicateGroup> {
        // Group by hash
        let mut groups: HashMap<Hash, Vec<FileInfo>> = HashMap::new();
        
        for file in &self.files {
            groups.entry(file.hash.clone())
                .or_insert_with(Vec::new)
                .push(file.clone());
        }
        
        // Keep only groups with duplicates
        groups
            .into_iter()
            .filter(|(_, files)| files.len() > 1)
            .map(|(hash, files)| {
                let size = files[0].size;
                let count = files.len() as u64;
                
                DuplicateGroup {
                    hash,
                    total_size: size * count,
                    wasted_space: size * (count - 1),
                    files,
                }
            })
            .collect()
    }
    
    pub fn total_wasted_space(&self) -> u64 {
        self.find_duplicates()
            .iter()
            .map(|g| g.wasted_space)
            .sum()
    }
}
```

#### 4. TUI: Interactive Review

```rust
use ratatui::{
    backend::CrosstermBackend,
    widgets::{Block, Borders, List, ListItem},
    Terminal,
};
use crossterm::{
    event::{self, Event, KeyCode},
    terminal::{disable_raw_mode, enable_raw_mode},
};

pub struct App {
    duplicate_groups: Vec<DuplicateGroup>,
    selected_group: usize,
    selected_file: usize,
    marked_for_deletion: HashSet<PathBuf>,
}

impl App {
    pub fn run(&mut self) -> Result<()> {
        enable_raw_mode()?;
        let mut terminal = Terminal::new(CrosstermBackend::new(io::stdout()))?;
        
        loop {
            terminal.draw(|f| self.draw(f))?;
            
            if let Event::Key(key) = event::read()? {
                match key.code {
                    KeyCode::Char('q') => break,
                    KeyCode::Up => self.select_previous(),
                    KeyCode::Down => self.select_next(),
                    KeyCode::Char(' ') => self.toggle_marked(),
                    KeyCode::Char('d') => self.delete_marked()?,
                    _ => {}
                }
            }
        }
        
        disable_raw_mode()?;
        Ok(())
    }
    
    fn draw(&self, frame: &mut Frame) {
        // Draw groups list
        let groups: Vec<ListItem> = self.duplicate_groups
            .iter()
            .enumerate()
            .map(|(i, group)| {
                let style = if i == self.selected_group {
                    Style::default().bg(Color::DarkGray)
                } else {
                    Style::default()
                };
                
                ListItem::new(format!(
                    "{} duplicates - {} wasted",
                    group.files.len(),
                    format_bytes(group.wasted_space)
                )).style(style)
            })
            .collect();
        
        // Render...
    }
}
```

## Performance Optimizations

### 1. Smarter Size-First Grouping

```rust
// Don't hash everything - only files with matching sizes
fn optimized_duplicate_detection(files: Vec<FileInfo>) -> Vec<DuplicateGroup> {
    // Group by size first (no I/O needed)
    let mut size_groups: HashMap<u64, Vec<FileInfo>> = HashMap::new();
    for file in files {
        size_groups.entry(file.size)
            .or_insert_with(Vec::new)
            .push(file);
    }
    
    // Only hash files that have size duplicates
    let to_hash: Vec<FileInfo> = size_groups
        .into_iter()
        .filter(|(_, files)| files.len() > 1)  // Skip unique sizes
        .flat_map(|(_, files)| files)
        .collect();
    
    // Now hash and group
    hash_and_group(to_hash)
}
```

**Result**: ~60% reduction in files hashed on typical filesystems.

### 2. Skipping Small Files

```rust
// Files under 1KB are rarely worth the I/O cost
const MIN_SIZE: u64 = 1024;

// Configuration
pub struct ScanConfig {
    pub min_size: u64,  // User configurable
}
```

**Result**: ~30% faster scans, skipping thousands of tiny config files.

### 3. Parallel Everything

```rust
use rayon::prelude::*;

// Parallel scanning, hashing, and analysis
let duplicates: Vec<DuplicateGroup> = directories
    .par_iter()  // Parallel scan
    .flat_map(|dir| scan_directory(dir))
    .collect::<Vec<_>>()
    .into_par_iter()  // Parallel hash
    .filter_map(|file| hash_file(file))
    .collect::<Vec<_>>()
    .into_iter()  // Sequential group (HashMap isn't thread-safe)
    .group_by_hash()
    .filter(|group| group.len() > 1)
    .collect();
```

**Result**: Near-linear speedup with CPU cores.

## Testing Strategy

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    #[test]
    fn test_duplicate_detection() {
        let dir = tempdir().unwrap();
        
        // Create test files
        std::fs::write(dir.path().join("file1.txt"), "content").unwrap();
        std::fs::write(dir.path().join("file2.txt"), "content").unwrap();
        std::fs::write(dir.path().join("file3.txt"), "different").unwrap();
        
        let scanner = Scanner::new(dir.path());
        let files = scanner.scan().unwrap();
        let detector = DuplicateDetector::new(files);
        
        let duplicates = detector.find_duplicates();
        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0].files.len(), 2);
    }
}
```

### Benchmarks

```rust
use criterion::{black_box, criterion_group, criterion_main, Criterion};

fn bench_blake3_hashing(c: &mut Criterion) {
    let test_file = create_test_file(10 * 1024 * 1024);  // 10MB
    
    c.bench_function("blake3 10MB", |b| {
        b.iter(|| {
            let hasher = Blake3HashImpl;
            hasher.hash_file(black_box(&test_file))
        })
    });
}

criterion_group!(benches, bench_blake3_hashing);
criterion_main!(benches);
```

**Results**:
- blake3: ~3GB/s
- xxhash: ~8GB/s  
- sha256: ~500MB/s

## Lessons Learned

### 1. Rust Makes You Think About Performance

The language design nudges you toward efficient patterns:
- Zero-cost abstractions
- Explicit memory layout
- No hidden allocations

### 2. The Ecosystem is Excellent

Amazing crates:
- `rayon` for parallelism
- `walkdir` for filesystem traversal  
- `ratatui` for TUI
- `anyhow` for error handling
- `clap` for CLI parsing

### 3. Compilation Time Matters

Large Rust projects take time to compile. Strategies:
- Use `cargo check` for fast feedback
- Modularize to improve incremental builds
- Use `sccache` for caching
- Consider `mold` linker for faster linking

## What's Next

July plans for DedCore:

1. **Advanced Filtering**: Regex patterns, date ranges
2. **Export Formats**: JSON, CSV reports
3. **Dry-Run Mode**: Preview changes safely
4. **Compression Analysis**: Find candidates for compression
5. **GUI Version**: Desktop app with Tauri

## Try It Yourself

DedCore is open source! Check it out at [dedcore.live](https://dedcore.live)

```bash
# Install
cargo install dedcore

# Scan directory
dedcore scan ~/Documents

# Interactive TUI
dedcore tui ~/Documents

# Generate report
dedcore report --format json ~/Documents > report.json
```

---

*What's your experience with Rust? What projects are you building? Let me know!*
