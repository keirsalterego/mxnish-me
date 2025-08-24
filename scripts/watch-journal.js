#!/usr/bin/env node
import { watch } from "chokidar";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const journalDir = join(projectRoot, "obsidian/journal");

console.log("🔍 Watching for changes in:", journalDir);

const watcher = watch(journalDir, {
  ignoreInitial: true,
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});

const syncJournal = () => {
  try {
    console.log("🔄 Syncing journal...");
    execSync("pnpm sync-journal", { stdio: "inherit", cwd: projectRoot });

    // Check if there are changes to commit (check obsidian folder since we're reading directly from there now)
    const status = execSync("git status --porcelain obsidian/journal/", {
      cwd: projectRoot
    }).toString();
    if (status.trim()) {
      console.log("💾 Committing journal changes...");
      execSync("git add obsidian/journal/", {
        stdio: "inherit",
        cwd: projectRoot
      });

      // Get the current timestamp for commit message
      const timestamp = new Date().toISOString().split("T")[0];
      execSync(`git commit -m "journal: update entries ${timestamp}"`, {
        stdio: "inherit",
        cwd: projectRoot
      });

      console.log("🚀 Pushing changes to remote...");
      execSync("git push", {
        stdio: "inherit",
        cwd: projectRoot
      });
      console.log("✅ Journal successfully synced and deployed!");
      console.log("🌐 Your changes are now live on mxnish.me");
    } else {
      console.log("✅ No changes to commit");
    }
  } catch (error) {
    console.error("❌ Error syncing journal:", error.message);
    // Don't exit the watcher on sync errors, just log them
  }
};

// Set up event listeners
watcher
  .on("add", (path) => {
    console.log(`📄 File ${path} has been added`);
    syncJournal();
  })
  .on("change", (path) => {
    console.log(`✏️  File ${path} has been changed`);
    syncJournal();
  })
  .on("unlink", (path) => {
    console.log(`🗑️  File ${path} has been removed`);
    syncJournal();
  })
  .on("error", (error) => console.error("Watcher error:", error));

console.log("👀 Journal watcher is running. Press Ctrl+C to stop.");

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n👋 Stopping journal watcher...");
  watcher.close().then(() => process.exit(0));
});
