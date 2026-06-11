import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { log } from "./logger.js";

// Tracks book files that failed to delete (e.g. locked on Windows because the
// file is still open in a reader). The DB record is removed regardless, so the
// file would otherwise linger as an orphan on disk forever. We persist the
// failed paths to userData/orphans.json and retry deleting them on startup.

function orphansFile(): string {
  return path.join(app.getPath("userData"), "orphans.json");
}

async function readOrphans(): Promise<string[]> {
  try {
    const raw = await fs.readFile(orphansFile(), "utf-8");
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((entry): entry is string => typeof entry === "string");
    }
  } catch {
    // missing or malformed file → treat as empty list
  }
  return [];
}

async function writeOrphans(paths: string[]): Promise<void> {
  try {
    await fs.writeFile(orphansFile(), JSON.stringify(paths, null, 2), "utf-8");
  } catch (error) {
    log.error("orphans: failed to persist orphans.json", error);
  }
}

// Record a file path that could not be deleted so it can be retried later.
export async function recordOrphan(filePath: string): Promise<void> {
  try {
    const current = await readOrphans();
    if (current.includes(filePath)) return;
    current.push(filePath);
    await writeOrphans(current);
    log.warn("orphans: recorded undeletable file for later sweep", filePath);
  } catch (error) {
    log.error("orphans: failed to record orphan", filePath, error);
  }
}

// Retry deleting any recorded orphan paths; drop the ones that succeed (or no
// longer exist). Best-effort: never throws.
export async function sweepOrphans(): Promise<void> {
  try {
    const current = await readOrphans();
    if (current.length === 0) return;

    const remaining: string[] = [];
    for (const filePath of current) {
      try {
        await fs.rm(filePath);
        log.info("orphans: swept orphaned file", filePath);
      } catch (error) {
        const code = (error as NodeJS.ErrnoException)?.code;
        if (code === "ENOENT") {
          // already gone — drop it
          log.info("orphans: orphan no longer exists, dropping", filePath);
          continue;
        }
        // still locked / inaccessible — keep for next startup
        remaining.push(filePath);
      }
    }

    if (remaining.length === current.length) return;
    await writeOrphans(remaining);
  } catch (error) {
    log.error("orphans: sweep failed", error);
  }
}
