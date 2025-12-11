#!/usr/bin/env node
import { watch } from "chokidar";
import { execSync } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, "..");
const journalDir = join(projectRoot, "obsidian/journal");

const DEBOUNCE_MINUTES = 30;
const DEBOUNCE_MS = DEBOUNCE_MINUTES * 60 * 1000;

let syncTimeout = null;
let syncInFlight = false;
let lastReason = "startup";

const scheduleSync = (reason = "change") => {
  lastReason = reason;
  if (syncTimeout) clearTimeout(syncTimeout);

  const runAt = new Date(Date.now() + DEBOUNCE_MS);
  console.log(
    `⏳ Waiting ${DEBOUNCE_MINUTES}m of inactivity before sync (${reason}). Next sync at ${runAt.toLocaleTimeString()}`
  );

  syncTimeout = setTimeout(() => triggerSync(reason), DEBOUNCE_MS);
};

const triggerSync = (reason) => {
  if (syncInFlight) {
    console.log("⚠️ Sync already running; skipping queued run");
    return;
  }

  syncInFlight = true;
  console.log(`🔄 Syncing journal after inactivity (${reason})...`);
  try {
    execSync("pnpm sync-journal", { stdio: "inherit", cwd: projectRoot });
    console.log("✅ Sync run finished");
  } catch (error) {
    console.error("❌ Error syncing journal:", error.message);
  } finally {
    syncInFlight = false;
    scheduleSync("post-sync");
  }
};

console.log("🔍 Watching for changes in:", journalDir);

const watcher = watch(journalDir, {
  ignoreInitial: true,
  ignored: /(^|[\/\\])\../, // ignore dotfiles
  persistent: true
});

// Set up event listeners
watcher
  .on("add", (path) => {
    console.log(`📄 File ${path} has been added`);
    scheduleSync("file added");
  })
  .on("change", (path) => {
    console.log(`✏️  File ${path} has been changed`);
    scheduleSync("file changed");
  })
  .on("unlink", (path) => {
    console.log(`🗑️  File ${path} has been removed`);
    scheduleSync("file removed");
  })
  .on("error", (error) => console.error("Watcher error:", error));

console.log("👀 Journal watcher is running. Press Ctrl+C to stop.");

// Kick off the initial idle timer so a sync happens if the vault stays quiet
scheduleSync("startup");

// Handle process termination
process.on("SIGINT", () => {
  console.log("\n👋 Stopping journal watcher...");
  watcher.close().then(() => process.exit(0));
});
