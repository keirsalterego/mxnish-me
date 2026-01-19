# Journal Automation Setup

Your Obsidian journal entries are automatically synced, committed, and pushed to your portfolio website at mxnish.me. Here's how the system works and how to use it.

## How It Works

1. **Write** journal entries in `obsidian/journal/yyyy-mm-dd.md`
2. **Automatic Sync** copies files to `src/content/journal/`
3. **Frontmatter Guard** auto-adds YAML if missing
4. **Git Integration** commits and pushes changes automatically
5. **Live Website** updates on your portfolio

## File Structure

```
obsidian/journal/           # Your Obsidian journal files
├── 2025-08-25.md         # Daily journal entries
└── ...

src/content/journal/        # Astro content collection
├── 2025-08-25.md         # Synced journal entries
└── ...
```

## Usage Options

### Option 1: Continuous Sync Every 30 Minutes (Recommended)
```bash
pnpm sync-journal
```

This will:
- ⏰ Check for changes every 30 minutes
- 🔄 Automatically sync files from `obsidian/journal/` to `src/content/journal/`
- ✨ Normalize frontmatter for each Obsidian entry
- 🗑️ Remove stale files from the website
- 💾 Commit changes to Git (only if changes detected)
- 🚀 Push to remote repository
- ✅ Deploy to your website
- 🔁 Keep running indefinitely

### Option 2: Manual One-Time Sync
```bash
pnpm sync-journal:once
```

This will:
- Run once and exit
- Normalize frontmatter for each Obsidian entry
- Mirror files into `src/content/journal/` (stale files are removed)
- Commit and push changes to origin

### Option 3: Automatic File Watching (Alternative)
```bash
pnpm watch-journal
```

This will:
- 🔍 Watch for changes in `obsidian/journal/`
- ⏳ Wait until there has been no change for ~30 minutes, then run the sync once
- 🔄 Automatically run the same sync flow as above (frontmatter, mirror, prune)
- 💾 Commit changes to Git
- 🚀 Push to remote repository
- ✅ Deploy to your website

### After a reset: quick setup

1. Install dependencies once: `pnpm install`
2. Seed the repo with your latest notes: `pnpm sync-journal:once`
3. For continuous automatic sync: `pnpm sync-journal` (leave it running in a terminal)
4. Verify on the site after the push completes

### Auto-start sync on login (Linux systemd user service)

1) Create a user service file:

`~/.config/systemd/user/sync-journal.service`
```ini
[Unit]
Description=Sync Obsidian journal every 30 minutes
After=network.target

[Service]
Type=simple
WorkingDirectory=/home/keirsalterego/mxnish-me
ExecStart=/usr/bin/env pnpm sync-journal
Restart=always
RestartSec=5

[Install]
WantedBy=default.target
```

2) Enable and start it:
```bash
systemctl --user daemon-reload
systemctl --user enable --now sync-journal.service
```

3) Check logs if needed:
```bash
journalctl --user -u sync-journal.service -f
```

Notes:
- Make sure `pnpm` is on your PATH for the user session (the `env` shebang will pick it up).
- The script checks for changes every 30 minutes and only commits/pushes if changes are detected.

## Journal Entry Format

Your journal entries should include frontmatter:

```markdown
---
title: "Your Journal Title"
date: "2025-08-25"
description: "Optional description"
---

# Your Journal Content

Write your journal entry here...
```

If you don't include frontmatter, it will be automatically added with:
- Title: "Journal - YYYY-MM-DD"
- Date: Based on filename
- Description: "Daily journal entry"

## Accessing Your Journal

Your journal entries will be available at:
- Individual entries: `https://mxnish.me/journal/2025-08-25`
- Journal collection: Accessible through your site's journal section

## Scripts Overview

- **`scripts/sync-journal.js`** - Copies files from Obsidian to Astro content
- **`scripts/watch-journal.js`** - File watcher with Git automation
- **`src/pages/journal/[...slug].astro`** - Dynamic journal page renderer
- **`src/layouts/Journal.astro`** - Journal entry layout

## Troubleshooting

### File Watcher Not Working
- Ensure `chokidar` is installed: `pnpm install`
- Check that the watcher is running: `pnpm watch-journal`

### Changes Not Appearing on Website
- Verify files are synced: Check `src/content/journal/`
- Ensure Git changes are committed and pushed
- Check your deployment pipeline

### Frontmatter Issues
- Ensure proper YAML formatting
- Date format should be "YYYY-MM-DD"
- Title should be quoted if it contains special characters

## Development

To modify the automation:
1. Edit sync logic in `scripts/sync-journal.js`
2. Modify file watching in `scripts/watch-journal.js`
3. Update journal schema in `src/content/config.ts`
4. Customize layout in `src/layouts/Journal.astro`
