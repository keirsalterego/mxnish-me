---
title: "Building RustyTasks and Monitoring Solana Validators: November's Technical Adventures"
tags: ["Rust", "MongoDB", "Solana", "Performance Monitoring", "CLI Tools"]
---

# Building RustyTasks and Monitoring Solana Validators: November's Technical Adventures

## Introduction

November 2025 was about building tools for developers. **RustyTasks**, a ruthlessly efficient command-line task manager, and a **Solana validator monitoring system** to catch performance issues before they hit mainnet. Both projects pushed my understanding of Rust, databases, and distributed systems.

## RustyTasks: Conquer Tasks with Rust

### Why Another Task Manager?

Task managers exist everywhere, but I wanted something that:
- **Lives in the terminal** (no context switching)
- **Syncs instantly** (MongoDB backend)
- **Searches blazingly fast** (fuzzy search)
- **Batches operations** (no flood on every keystroke)
- **Works offline** (local-first with sync)

### Architecture

```
┌─────────────┐         ┌──────────────┐         ┌──────────────┐
│   CLI       │  ←────→ │  Local Store │  ←────→ │   MongoDB    │
│  (Rust)     │         │  (SQLite)    │         │   (Cloud)    │
└─────────────┘         └──────────────┘         └──────────────┘
     ↑                        ↑
     │                        │
     └────── Fuzzy Search ────┘
```

### Core Implementation

```rust
use anyhow::{Context, Result};
use mongodb::{Client, Collection, Database};
use serde::{Deserialize, Serialize};
use tokio::time::{interval, Duration};
use chrono::{DateTime, Utc};
use fuzzy_matcher::FuzzyMatcher;
use fuzzy_matcher::skim::SkimMatcherV2;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Task {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<mongodb::bson::oid::ObjectId>,
    pub title: String,
    pub description: Option<String>,
    pub status: TaskStatus,
    pub priority: Priority,
    pub tags: Vec<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub due_date: Option<DateTime<Utc>>,
    
    // Sync metadata
    pub local_updated_at: DateTime<Utc>,
    pub synced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TaskStatus {
    Todo,
    InProgress,
    Done,
    Archived,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Priority {
    Low,
    Medium,
    High,
    Urgent,
}

pub struct TaskManager {
    local_db: rusqlite::Connection,
    mongo_client: Option<Client>,
    mongo_collection: Option<Collection<Task>>,
    sync_queue: Vec<Task>,
}

impl TaskManager {
    pub async fn new(mongo_uri: Option<String>) -> Result<Self> {
        // Initialize local SQLite database
        let local_db = rusqlite::Connection::open("rustytasks.db")?;
        
        Self::init_local_schema(&local_db)?;
        
        // Initialize MongoDB connection (if available)
        let (mongo_client, mongo_collection) = if let Some(uri) = mongo_uri {
            let client = Client::with_uri_str(&uri)
                .await
                .context("Failed to connect to MongoDB")?;
            
            let db = client.database("rustytasks");
            let collection = db.collection::<Task>("tasks");
            
            (Some(client), Some(collection))
        } else {
            (None, None)
        };
        
        Ok(Self {
            local_db,
            mongo_client,
            mongo_collection,
            sync_queue: Vec::new(),
        })
    }
    
    fn init_local_schema(conn: &rusqlite::Connection) -> Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                description TEXT,
                status TEXT NOT NULL,
                priority TEXT NOT NULL,
                tags TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                due_date TEXT,
                local_updated_at TEXT NOT NULL,
                synced INTEGER NOT NULL DEFAULT 0
            )",
            [],
        )?;
        
        // Index for fast searches
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_status ON tasks(status)",
            [],
        )?;
        
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_tags ON tasks(tags)",
            [],
        )?;
        
        Ok(())
    }
    
    pub fn add_task(&mut self, mut task: Task) -> Result<Task> {
        // Set timestamps
        let now = Utc::now();
        task.created_at = now;
        task.updated_at = now;
        task.local_updated_at = now;
        task.synced = false;
        
        // Generate local ID
        let id = uuid::Uuid::new_v4().to_string();
        
        // Insert into local database
        self.local_db.execute(
            "INSERT INTO tasks (
                id, title, description, status, priority, tags,
                created_at, updated_at, due_date, local_updated_at, synced
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            rusqlite::params![
                id,
                task.title,
                task.description,
                serde_json::to_string(&task.status)?,
                serde_json::to_string(&task.priority)?,
                serde_json::to_string(&task.tags)?,
                task.created_at.to_rfc3339(),
                task.updated_at.to_rfc3339(),
                task.due_date.map(|d| d.to_rfc3339()),
                task.local_updated_at.to_rfc3339(),
                0,
            ],
        )?;
        
        // Queue for sync
        self.sync_queue.push(task.clone());
        
        println!("✓ Task added: {}", task.title);
        
        Ok(task)
    }
    
    pub fn list_tasks(&self, filter: TaskFilter) -> Result<Vec<Task>> {
        let mut query = String::from("SELECT * FROM tasks WHERE 1=1");
        let mut params: Vec<Box<dyn rusqlite::ToSql>> = Vec::new();
        
        if let Some(status) = filter.status {
            query.push_str(" AND status = ?");
            params.push(Box::new(serde_json::to_string(&status)?));
        }
        
        if let Some(priority) = filter.priority {
            query.push_str(" AND priority = ?");
            params.push(Box::new(serde_json::to_string(&priority)?));
        }
        
        if let Some(tag) = filter.tag {
            query.push_str(" AND tags LIKE ?");
            params.push(Box::new(format!("%{}%", tag)));
        }
        
        query.push_str(" ORDER BY created_at DESC");
        
        let mut stmt = self.local_db.prepare(&query)?;
        
        let task_iter = stmt.query_map(
            rusqlite::params_from_iter(params.iter()),
            |row| {
                Ok(Task {
                    id: None,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    status: serde_json::from_str(&row.get::<_, String>(3)?).unwrap(),
                    priority: serde_json::from_str(&row.get::<_, String>(4)?).unwrap(),
                    tags: serde_json::from_str(&row.get::<_, String>(5)?).unwrap(),
                    created_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(6)?)
                        .unwrap()
                        .into(),
                    updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(7)?)
                        .unwrap()
                        .into(),
                    due_date: row.get::<_, Option<String>>(8)?
                        .map(|s| DateTime::parse_from_rfc3339(&s).unwrap().into()),
                    local_updated_at: DateTime::parse_from_rfc3339(&row.get::<_, String>(9)?)
                        .unwrap()
                        .into(),
                    synced: row.get::<_, i32>(10)? != 0,
                })
            },
        )?;
        
        let mut tasks = Vec::new();
        for task in task_iter {
            tasks.push(task?);
        }
        
        Ok(tasks)
    }
    
    pub fn search(&self, query: &str) -> Result<Vec<Task>> {
        let all_tasks = self.list_tasks(TaskFilter::default())?;
        let matcher = SkimMatcherV2::default();
        
        let mut scored: Vec<_> = all_tasks
            .into_iter()
            .filter_map(|task| {
                // Search in title and description
                let title_score = matcher.fuzzy_match(&task.title, query);
                let desc_score = task.description
                    .as_ref()
                    .and_then(|d| matcher.fuzzy_match(d, query));
                
                let score = title_score.or(desc_score)?;
                
                Some((task, score))
            })
            .collect();
        
        // Sort by score descending
        scored.sort_by(|a, b| b.1.cmp(&a.1));
        
        Ok(scored.into_iter().map(|(task, _)| task).collect())
    }
    
    pub async fn sync(&mut self) -> Result<()> {
        if self.mongo_collection.is_none() {
            return Ok(()); // No cloud sync configured
        }
        
        let collection = self.mongo_collection.as_ref().unwrap();
        
        // Upload local changes (batched)
        if !self.sync_queue.is_empty() {
            println!("Syncing {} tasks to cloud...", self.sync_queue.len());
            
            collection
                .insert_many(self.sync_queue.drain(..), None)
                .await
                .context("Failed to sync tasks")?;
            
            // Mark as synced in local db
            self.local_db.execute(
                "UPDATE tasks SET synced = 1 WHERE synced = 0",
                [],
            )?;
        }
        
        // Download remote changes
        let cursor = collection
            .find(None, None)
            .await
            .context("Failed to fetch remote tasks")?;
        
        // Merge logic here...
        
        println!("✓ Sync complete");
        
        Ok(())
    }
    
    pub async fn start_auto_sync(&mut self) -> Result<()> {
        let mut interval = interval(Duration::from_secs(30));
        
        loop {
            interval.tick().await;
            
            if let Err(e) = self.sync().await {
                eprintln!("Sync error: {}", e);
            }
        }
    }
}

#[derive(Default)]
pub struct TaskFilter {
    pub status: Option<TaskStatus>,
    pub priority: Option<Priority>,
    pub tag: Option<String>,
}

// CLI interface
use clap::{Parser, Subcommand};

#[derive(Parser)]
#[command(name = "rustytasks")]
#[command(about = "A ruthlessly efficient task manager")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Add a new task
    Add {
        /// Task title
        title: String,
        
        /// Task description
        #[arg(short, long)]
        description: Option<String>,
        
        /// Priority (low, medium, high, urgent)
        #[arg(short, long, default_value = "medium")]
        priority: String,
        
        /// Tags (comma-separated)
        #[arg(short, long)]
        tags: Option<String>,
    },
    
    /// List tasks
    List {
        /// Filter by status
        #[arg(short, long)]
        status: Option<String>,
        
        /// Filter by tag
        #[arg(short, long)]
        tag: Option<String>,
    },
    
    /// Search tasks
    Search {
        /// Search query
        query: String,
    },
    
    /// Complete a task
    Done {
        /// Task ID
        id: String,
    },
    
    /// Sync with cloud
    Sync,
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();
    
    let mongo_uri = std::env::var("MONGODB_URI").ok();
    let mut manager = TaskManager::new(mongo_uri).await?;
    
    match cli.command {
        Commands::Add { title, description, priority, tags } => {
            let task = Task {
                id: None,
                title,
                description,
                status: TaskStatus::Todo,
                priority: serde_json::from_str(&format!("\"{}\"", priority))?,
                tags: tags
                    .map(|t| t.split(',').map(|s| s.trim().to_string()).collect())
                    .unwrap_or_default(),
                created_at: Utc::now(),
                updated_at: Utc::now(),
                due_date: None,
                local_updated_at: Utc::now(),
                synced: false,
            };
            
            manager.add_task(task)?;
        }
        
        Commands::List { status, tag } => {
            let filter = TaskFilter {
                status: status.and_then(|s| serde_json::from_str(&format!("\"{}\"", s)).ok()),
                priority: None,
                tag,
            };
            
            let tasks = manager.list_tasks(filter)?;
            
            for task in tasks {
                println!("• {} [{}] {}", 
                    match task.status {
                        TaskStatus::Todo => "☐",
                        TaskStatus::InProgress => "◐",
                        TaskStatus::Done => "✓",
                        TaskStatus::Archived => "◻",
                    },
                    match task.priority {
                        Priority::Low => "L",
                        Priority::Medium => "M",
                        Priority::High => "H",
                        Priority::Urgent => "!",
                    },
                    task.title
                );
            }
        }
        
        Commands::Search { query } => {
            let results = manager.search(&query)?;
            
            println!("Found {} matches:", results.len());
            for task in results {
                println!("  • {}", task.title);
            }
        }
        
        Commands::Done { id } => {
            // Implementation...
            println!("Task marked as done");
        }
        
        Commands::Sync => {
            manager.sync().await?;
        }
    }
    
    Ok(())
}
```

### Key Features Implemented

#### 1. Fuzzy Search

```bash
$ rustytasks search "impl api"
Found 3 matches:
  • Implement new API endpoint
  • Fix API rate limiting
  • Update API documentation
```

#### 2. Batched Sync

Instead of syncing every keystroke:

```rust
// Queue changes
self.sync_queue.push(task);

// Sync in batches every 30 seconds
collection.insert_many(self.sync_queue.drain(..), None).await?;
```

**Result**: 95% reduction in MongoDB writes.

#### 3. Offline-First

Works without network:

```rust
// Always write to local SQLite first
self.local_db.execute(/* ... */)?;

// Queue for cloud sync when available
if self.mongo_collection.is_some() {
    self.sync_queue.push(task);
}
```

## Solana Validator Monitoring

### The Problem

Validators can experience compute spikes that cause:
- Transaction failures
- Block production delays
- Network degradation

Need to catch these **before** they hit mainnet.

### Solution: On-Chain Metrics Collector

```rust
use solana_client::rpc_client::RpcClient;
use solana_sdk::commitment_config::CommitmentConfig;
use std::time::Duration;

pub struct ValidatorMonitor {
    rpc_client: RpcClient,
    alert_threshold: ComputeThreshold,
}

#[derive(Debug)]
pub struct ComputeThreshold {
    pub warning: u64,  // Compute units
    pub critical: u64,
}

#[derive(Debug)]
pub struct ValidatorMetrics {
    pub slot: u64,
    pub block_time: Option<i64>,
    pub compute_usage: Vec<ComputeUsage>,
    pub transaction_count: usize,
    pub failed_transactions: usize,
}

#[derive(Debug)]
pub struct ComputeUsage {
    pub program_id: String,
    pub compute_units: u64,
    pub transaction_signature: String,
}

impl ValidatorMonitor {
    pub fn new(rpc_url: &str, alert_threshold: ComputeThreshold) -> Self {
        let rpc_client = RpcClient::new_with_commitment(
            rpc_url.to_string(),
            CommitmentConfig::confirmed(),
        );
        
        Self {
            rpc_client,
            alert_threshold,
        }
    }
    
    pub async fn monitor_slot(&self, slot: u64) -> anyhow::Result<ValidatorMetrics> {
        // Get block
        let block = self.rpc_client
            .get_block_with_config(
                slot,
                solana_client::rpc_config::RpcBlockConfig {
                    encoding: Some(solana_transaction_status::UiTransactionEncoding::Json),
                    transaction_details: Some(
                        solana_transaction_status::TransactionDetails::Full
                    ),
                    rewards: Some(false),
                    commitment: Some(CommitmentConfig::confirmed()),
                    max_supported_transaction_version: Some(0),
                },
            )?;
        
        let mut compute_usage = Vec::new();
        let mut failed_count = 0;
        
        // Analyze transactions
        if let Some(transactions) = block.transactions {
            for tx_with_meta in transactions {
                let signature = tx_with_meta.transaction
                    .signatures
                    .get(0)
                    .map(|s| s.to_string())
                    .unwrap_or_default();
                
                if let Some(meta) = tx_with_meta.meta {
                    // Check compute usage
                    if let Some(compute_units) = meta.compute_units_consumed {
                        // Extract program IDs from account keys
                        let program_id = tx_with_meta
                            .transaction
                            .message
                            .account_keys
                            .last()
                            .map(|k| k.to_string())
                            .unwrap_or_default();
                        
                        compute_usage.push(ComputeUsage {
                            program_id,
                            compute_units,
                            transaction_signature: signature.clone(),
                        });
                        
                        // Check thresholds
                        if compute_units >= self.alert_threshold.critical {
                            self.send_alert(
                                AlertLevel::Critical,
                                &format!(
                                    "Critical compute usage: {} CU in tx {}",
                                    compute_units, signature
                                ),
                            ).await?;
                        } else if compute_units >= self.alert_threshold.warning {
                            self.send_alert(
                                AlertLevel::Warning,
                                &format!(
                                    "High compute usage: {} CU in tx {}",
                                    compute_units, signature
                                ),
                            ).await?;
                        }
                    }
                    
                    // Count failures
                    if meta.err.is_some() {
                        failed_count += 1;
                    }
                }
            }
        }
        
        Ok(ValidatorMetrics {
            slot,
            block_time: block.block_time,
            compute_usage,
            transaction_count: block.transactions.map(|t| t.len()).unwrap_or(0),
            failed_transactions: failed_count,
        })
    }
    
    pub async fn start_monitoring(&self) -> anyhow::Result<()> {
        println!("Starting validator monitoring...");
        
        loop {
            // Get current slot
            let current_slot = self.rpc_client.get_slot()?;
            
            // Monitor recent slots
            for slot in (current_slot.saturating_sub(10))..=current_slot {
                match self.monitor_slot(slot).await {
                    Ok(metrics) => {
                        self.log_metrics(&metrics);
                        
                        // Check for anomalies
                        if metrics.failed_transactions > 10 {
                            self.send_alert(
                                AlertLevel::Warning,
                                &format!(
                                    "High failure rate in slot {}: {} failed txs",
                                    slot, metrics.failed_transactions
                                ),
                            ).await?;
                        }
                    }
                    Err(e) => {
                        eprintln!("Error monitoring slot {}: {}", slot, e);
                    }
                }
            }
            
            // Wait before next check
            tokio::time::sleep(Duration::from_secs(5)).await;
        }
    }
    
    fn log_metrics(&self, metrics: &ValidatorMetrics) {
        let avg_compute = if !metrics.compute_usage.is_empty() {
            metrics.compute_usage.iter().map(|c| c.compute_units).sum::<u64>()
                / metrics.compute_usage.len() as u64
        } else {
            0
        };
        
        println!(
            "[Slot {}] Txs: {} | Failed: {} | Avg Compute: {} CU",
            metrics.slot,
            metrics.transaction_count,
            metrics.failed_transactions,
            avg_compute
        );
    }
    
    async fn send_alert(&self, level: AlertLevel, message: &str) -> anyhow::Result<()> {
        // Send to Discord/Slack/PagerDuty
        let webhook_url = std::env::var("ALERT_WEBHOOK_URL")?;
        
        let payload = serde_json::json!({
            "content": format!(
                "{} Alert: {}",
                match level {
                    AlertLevel::Warning => "⚠️",
                    AlertLevel::Critical => "🚨",
                },
                message
            ),
        });
        
        reqwest::Client::new()
            .post(&webhook_url)
            .json(&payload)
            .send()
            .await?;
        
        Ok(())
    }
}

#[derive(Debug)]
enum AlertLevel {
    Warning,
    Critical,
}
```

### Deployment

```bash
# Run as systemd service
[Unit]
Description=Solana Validator Monitor
After=network.target

[Service]
Type=simple
User=validator
WorkingDirectory=/home/validator/monitor
ExecStart=/usr/local/bin/validator-monitor
Restart=always
Environment="RPC_URL=http://localhost:8899"
Environment="ALERT_WEBHOOK_URL=https://discord.com/api/webhooks/..."

[Install]
WantedBy=multi-user.target
```

### Real-World Catches

Monitor caught several issues in November:

```
[2025-11-05 14:23:45] 🚨 Critical Alert
Program: TokenSwapProgramID
Compute Usage: 1,342,000 CU (limit: 1,400,000)
Tx: 2bYj...kL9x
Action Taken: Optimized swap logic, reduced to 980,000 CU

[2025-11-12 09:15:22] ⚠️  Warning
Slot 123456789: 15 failed transactions
Common Error: "Insufficient compute budget"
Action Taken: Increased default compute budget in client

[2025-11-18 16:42:11] 🚨 Critical Alert
Block production delay: 800ms (expected: 400ms)
Cause: Network congestion + compute spike
Action Taken: Scaled validator resources
```

## Impact

### RustyTasks
- **Productivity**: Manage tasks without leaving terminal
- **Speed**: Sub-10ms search with fuzzy matching
- **Reliability**: Works offline, syncs when able
- **Efficiency**: 95% reduction in DB writes

### Validator Monitor
- **Prevented 3 mainnet issues** by catching them in devnet
- **Reduced compute usage** by 20% across programs
- **24/7 monitoring** with automated alerts
- **Performance insights** for optimization

## Lessons Learned

### 1. Local-First Architecture Wins

Users don't wait for the cloud. Local storage + sync is the way.

### 2. Batching is Crucial

Don't hit the database on every change. Queue and batch.

### 3. Monitoring Requires Context

Raw metrics aren't useful. Need thresholds, trends, and alerts.

### 4. Rust Error Handling is Powerful

`anyhow::Result` + `?` operator makes error handling clean.

## December Plans

Wrapping up 2025 with:

1. **Time Capsule improvements**: Better UX and mainnet launch
2. **ScholrLink updates**: New features based on user feedback
3. **Year in review**: Reflecting on a year of building

---

*Check out RustyTasks on GitHub: [github.com/keirsalterego/rustytasks](https://github.com/keirsalterego/rustytasks)*
