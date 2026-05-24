import { app } from "electron";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const rootDir = path.join(__dirname, "..");

export function appIconPath(): string {
  return app.isPackaged
    ? path.join(process.resourcesPath, "icon.ico")
    : path.join(rootDir, "build", "icon.ico");
}

export async function ensureLibraryDir(): Promise<string> {
  const libraryDir = path.join(app.getPath("userData"), "library");
  await fs.mkdir(libraryDir, { recursive: true });
  return libraryDir;
}

export async function ensureCoverDir(): Promise<string> {
  const dir = path.join(app.getPath("userData"), "covers");
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function coverPathFor(bookId: string): string {
  const safe = bookId.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(app.getPath("userData"), "covers", `${safe}.jpg`);
}
