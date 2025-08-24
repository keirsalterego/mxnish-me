import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, "..");
const obsidianDir = path.join(rootDir, "obsidian/journal");

async function syncJournal() {
  try {
    // Read all journal files from Obsidian
    const files = await fs.readdir(obsidianDir);
    const markdownFiles = files.filter((file) => file.endsWith(".md"));

    console.log(`Found ${markdownFiles.length} journal files to process`);

    // Process each file to ensure proper frontmatter
    for (const file of markdownFiles) {
      const sourcePath = path.join(obsidianDir, file);

      // Read the file content
      let content = await fs.readFile(sourcePath, "utf-8");

      // Add frontmatter if not present
      if (!content.startsWith("---")) {
        const date = path.basename(file, ".md");
        const frontmatter = `---
title: "Journal - ${date}"
date: "${date}"
description: "Daily journal entry"
---\n\n`;
        content = frontmatter + content;

        // Write back to the original file
        await fs.writeFile(sourcePath, content, "utf-8");
        console.log(`Added frontmatter to: ${file}`);
      } else {
        console.log(`Already has frontmatter: ${file}`);
      }
    }

    console.log("Journal sync complete! Files are ready for direct reading.");
  } catch (error) {
    console.error("Error syncing journal:", error);
    process.exit(1);
  }
}

syncJournal();
