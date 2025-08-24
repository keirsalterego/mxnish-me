# Obsidian Journal Setup

This directory contains your Obsidian vault for journaling. Any markdown files you create here will be automatically synced to your portfolio.

## How to Use

1. **Install Obsidian**
   - Download and install [Obsidian](https://obsidian.md/) on your computer.
   - Open Obsidian and choose "Open folder as vault"
   - Select the `obsidian` directory in your project

2. **Create Journal Entries**
   - Create new markdown files in the `journal` folder
   - Name your files with the format `YYYY-MM-DD.md` (e.g., `2025-01-01.md`)
   - Write your journal entries in markdown format

3. **Sync with Portfolio**
   - Run `pnpm sync-journal` to sync your journal entries with your portfolio
   - Your journal will be available at `/journal` on your website

## Tips
- Use markdown for formatting
- Add a YAML frontmatter to customize the title and description
- Use `[[wiki-links]]` to link between notes
- Images and attachments will be automatically copied to the appropriate location

## Example Entry

```markdown
---
title: "My Journal Entry"
date: 2025-01-01
description: "A brief description of this entry"
---

# My Journal Entry

Today I worked on my portfolio and set up Obsidian integration.

## What I learned
- How to integrate Obsidian with Astro
- The power of markdown for journaling

## Next Steps
- [ ] Write more journal entries
- [ ] Add more features to my portfolio
```
