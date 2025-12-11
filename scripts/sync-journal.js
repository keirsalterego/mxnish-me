import { promises as fs } from "fs";
import { execSync } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const obsidianDir = path.join(rootDir, "obsidian/journal");
const contentDir = path.join(rootDir, "src/content/journal");

const run = (command, options = {}) =>
  execSync(command, {
    cwd: rootDir,
    stdio: options.stdio ?? "inherit"
  });

const runCapture = (command) =>
  execSync(command, { cwd: rootDir, stdio: "pipe" }).toString();

const ensureFrontmatter = (filename, rawContent) => {
  if (rawContent.startsWith("---")) {
    return { content: rawContent, changed: false };
  }

  const date = path.basename(filename, ".md");
  const frontmatter = `---
title: "Journal - ${date}"
date: "${date}"
description: "Daily journal entry"
---\n\n`;

  return { content: frontmatter + rawContent, changed: true };
};

async function syncJournal() {
  try {
    await fs.mkdir(contentDir, { recursive: true });

    const files = await fs.readdir(obsidianDir);
    const markdownFiles = files.filter((file) => file.endsWith(".md"));

    console.log(`Found ${markdownFiles.length} journal files to process`);

    for (const file of markdownFiles) {
      const sourcePath = path.join(obsidianDir, file);
      const destPath = path.join(contentDir, file);

      const rawContent = await fs.readFile(sourcePath, "utf-8");
      const { content, changed } = ensureFrontmatter(file, rawContent);

      if (changed) {
        await fs.writeFile(sourcePath, content, "utf-8");
        console.log(`Added frontmatter to: ${file}`);
      }

      await fs.writeFile(destPath, content, "utf-8");
      console.log(`Synced: ${file}`);
    }

    // Remove stale files from contentDir that no longer exist in Obsidian
    const destFiles = await fs.readdir(contentDir);
    const sourceSet = new Set(markdownFiles);
    for (const file of destFiles) {
      if (file.endsWith(".md") && !sourceSet.has(file)) {
        await fs.unlink(path.join(contentDir, file));
        console.log(`Removed stale entry: ${file}`);
      }
    }

    const status = runCapture(
      "git status --porcelain obsidian/journal src/content/journal"
    ).trim();

    if (!status) {
      console.log("✅ No changes to commit");
      return;
    }

    console.log("💾 Committing journal changes...");
    run("git add obsidian/journal src/content/journal");
    const timestamp = new Date().toISOString().split("T")[0];
    run(`git commit -m "journal: update entries ${timestamp}"`);

    console.log("🚀 Pushing changes to remote...");
    run("git push");

    console.log("✅ Journal successfully synced and deployed!");
  } catch (error) {
    console.error("Error syncing journal:", error);
    process.exit(1);
  }
}

syncJournal();
