---
title: "Merged into rust-lang/rust-clippy: Reflections on Contributing to Rust's Ecosystem"
tags: ["Rust", "Open Source", "Clippy", "Compiler", "DedCore"]
---

# Merged into rust-lang/rust-clippy: Reflections on Contributing to Rust's Ecosystem

## Introduction

January 2026 started with a win: my PR to rust-lang/rust-clippy finally merged! After months of work on the `useless_conversion` lint, seeing that green "Merged" badge was incredibly satisfying. This post reflects on what it takes to contribute to one of Rust's core tools and how it's influencing my current work on DedCore.

## The Journey to Merge

### The Problem Revisited

The `useless_conversion` lint had been generating false positives for over-borrowed patterns:

```rust
// This code is actually correct
let nested: &&Vec<i32> = &&vec![1, 2, 3];
let iter = nested.into_iter();  // Necessary conversion

// But Clippy incorrectly suggested:
// help: consider removing `.into_iter()`: `nested`
```

The issue? The lint wasn't accounting for automatic dereferencing in `.into_iter()` calls on nested references.

### The Solution

After deep diving into HIR (High-Level Intermediate Representation) and Rust's type inference, I implemented proper reference tracking:

```rust
// Simplified version of the fix
fn check_expr(&mut self, cx: &LateContext<'tcx>, expr: &'tcx Expr<'_>) {
    if let ExprKind::MethodCall(path, receiver, ..) = expr.kind {
        if path.ident.name == sym::into_iter {
            // Get the receiver type
            let receiver_ty = cx.typeck_results().expr_ty(receiver);
            
            // Count reference levels
            let mut ref_count = 0;
            let mut current_ty = receiver_ty;
            
            while let ty::Ref(_, inner_ty, _) = current_ty.kind() {
                ref_count += 1;
                current_ty = *inner_ty;
            }
            
            // Only suggest removal if conversion is truly useless
            // (not just moving references around)
            if ref_count <= 1 && /* other checks */ {
                span_lint_and_sugg(/* suggest removal */);
            }
        }
    }
}
```

### Review Process

The rust-lang review process is thorough:

1. **Initial Review** (Week 1): Maintainer reviewed logic and requested tests
2. **Test Additions** (Week 2): Added 15 test cases covering edge cases
3. **Documentation** (Week 3): Improved comments and lint documentation
4. **CI Failures** (Week 4): Fixed formatting and additional edge cases
5. **Final Approval** (Week 5): r+ from maintainer
6. **Merge** (Week 6): Landed in nightly!

**Key Lesson**: Patience and responsiveness to feedback are essential.

## Impact on the Rust Ecosystem

This seemingly small fix has broad reach:

```
Weekly Downloads of Projects Using Clippy: ~10M+
Estimated False Positives Prevented: Thousands
Developer Time Saved: Countless hours of confusion
```

Every Rust developer using Clippy (which is most of them) benefits from more accurate linting.

## Applying Learnings to DedCore

Working on Clippy taught me patterns I'm now using in DedCore:

### 1. Parallel Hashing Optimization

Understanding Rust's borrowing at a deep level helped optimize DedCore's hashing:

```rust
// Before: Sequential, simple
for file in files {
    let hash = compute_hash(&file)?;
    results.insert(file.path.clone(), hash);
}

// After: Parallel with proper ownership
use rayon::prelude::*;

let results: HashMap<PathBuf, Hash> = files
    .par_iter()
    .filter(|f| f.size >= MIN_SIZE)  // Skip tiny files
    .filter_map(|file| {
        compute_hash(file)
            .ok()
            .map(|hash| (file.path.clone(), hash))
    })
    .collect();
```

**Result**: ~15% faster on large datasets without memory blowup.

### 2. Better Error Messages

Clippy's focus on user experience inspired better DedCore errors:

```rust
// Before: Generic errors
Err(anyhow!("Hashing failed"))

// After: Actionable errors
pub enum DedCoreError {
    #[error("Failed to hash file {path}: {reason}")]
    HashError {
        path: PathBuf,
        reason: String,
    },
    
    #[error("Permission denied: {path}\nTry running with elevated permissions")]
    PermissionDenied {
        path: PathBuf,
    },
    
    #[error("File too large: {size} bytes (limit: {limit})\nConsider using --skip-large")]
    FileTooLarge {
        size: u64,
        limit: u64,
    },
}
```

Users now know exactly what went wrong and how to fix it.

### 3. Comprehensive Testing

Learned the importance of edge case testing:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;
    
    #[test]
    fn test_deduplication_empty_files() {
        let dir = tempdir().unwrap();
        
        // Create empty files
        std::fs::write(dir.path().join("empty1.txt"), "").unwrap();
        std::fs::write(dir.path().join("empty2.txt"), "").unwrap();
        
        let scanner = Scanner::new(dir.path());
        let files = scanner.scan().unwrap();
        
        let detector = DuplicateDetector::new(files);
        let duplicates = detector.find_duplicates();
        
        // Empty files should be detected as duplicates
        assert_eq!(duplicates.len(), 1);
        assert_eq!(duplicates[0].files.len(), 2);
    }
    
    #[test]
    fn test_symbolic_links() {
        // Test symlink handling...
    }
    
    #[test]
    fn test_permission_errors() {
        // Test graceful permission failure...
    }
    
    #[test]
    fn test_circular_symlinks() {
        // Test infinite loop prevention...
    }
}
```

DedCore now has >90% test coverage.

## Current Focus: DedCore Performance

With Clippy merged, I'm doubling down on DedCore optimization:

### Memory-Efficient Hashing

```rust
use std::io::{BufReader, Read};
use blake3::Hasher;

pub fn hash_file_streaming(path: &Path) -> Result<Hash> {
    let file = File::open(path)?;
    let mut reader = BufReader::with_capacity(8192, file);
    let mut hasher = Hasher::new();
    
    // Stream in chunks to avoid loading entire file
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
```

This handles multi-gigabyte files without excessive memory usage.

### Smart Filtering

```rust
pub struct FilterConfig {
    pub min_size: u64,
    pub max_size: Option<u64>,
    pub extensions: Option<HashSet<String>>,
    pub skip_hidden: bool,
}

impl Scanner {
    pub fn with_filter(mut self, config: FilterConfig) -> Self {
        self.filter = Some(config);
        self
    }
    
    fn should_scan(&self, entry: &DirEntry) -> bool {
        let Some(ref filter) = self.filter else {
            return true;
        };
        
        // Fast path: check file name
        if filter.skip_hidden {
            if let Some(name) = entry.file_name().to_str() {
                if name.starts_with('.') {
                    return false;
                }
            }
        }
        
        // Check metadata
        let Ok(metadata) = entry.metadata() else {
            return false;
        };
        
        let size = metadata.len();
        
        // Size filters
        if size < filter.min_size {
            return false;
        }
        
        if let Some(max) = filter.max_size {
            if size > max {
                return false;
            }
        }
        
        // Extension filter
        if let Some(ref exts) = filter.extensions {
            let path = entry.path();
            let ext = path.extension()
                .and_then(|e| e.to_str())
                .unwrap_or("");
            
            if !exts.contains(ext) {
                return false;
            }
        }
        
        true
    }
}
```

Users can now focus on relevant files only.

## What's Next

### February Goals

1. **DedCore v1.1**: Ship performance improvements
2. **Rust Compiler Contribution**: Looking at rustc itself
3. **Blog Series**: "Rust Compiler Internals for Contributors"

### Learning Rust Compiler Internals

The Clippy contribution opened doors to deeper compiler work:

- **Type Inference**: How Rust resolves types
- **Borrow Checking**: The magic behind Rust's safety
- **MIR (Mid-level IR)**: Optimization passes
- **Code Generation**: LLVM integration

Planning to contribute to rustc's type inference optimizations next.

## Advice for Aspiring Contributors

### Start Small

Don't jump into complex features. Good first contributions:

1. **Documentation Fixes**: Fix typos, improve examples
2. **Error Messages**: Make errors more helpful
3. **Test Coverage**: Add missing test cases
4. **Small Bugs**: Fix minor issues with clear solutions

### Read the Code

Before contributing:

```bash
# Clone and explore
git clone https://github.com/rust-lang/rust-clippy
cd rust-clippy

# Find the relevant code
rg "useless_conversion" --type rust

# Read tests to understand expected behavior
cat tests/ui/useless_conversion.rs

# Read implementation
cat clippy_lints/src/useless_conversion.rs
```

Understanding the codebase is 80% of the work.

### Engage with Community

- **Zulip**: Rust's chat platform for discussions
- **GitHub Issues**: Read comments on related issues
- **Rust Forums**: Ask questions, share progress
- **Twitter/Mastodon**: Follow Rust maintainers

### Be Patient

My PR took 6 weeks from opening to merge. That's normal for:
- Large projects with many contributors
- Code that affects millions of users
- Changes requiring careful review

Don't take delays personally.

## Reflections

Contributing to Clippy taught me:

1. **Code Quality Matters**: Rust's ecosystem expects excellence
2. **Communication is Key**: Clear explanations speed up reviews
3. **Testing Prevents Regressions**: Comprehensive tests build trust
4. **Feedback is a Gift**: Every review improves your skills

This experience shaped how I approach all my projects now.

## Join Me

If you're interested in:
- Rust compiler internals
- Contributing to open source
- Building high-performance tools

Follow along! I'll be documenting my next contributions and DedCore's evolution.

---

*Check out DedCore: [dedcore.live](https://dedcore.live)*  
*My Clippy PR: [rust-lang/rust-clippy#16238](https://github.com/rust-lang/rust-clippy/pull/16238)*
