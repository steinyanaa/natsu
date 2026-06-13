import { app } from "electron";
import path from "node:path";
import fs from "node:fs";

// Zero-dependency logger for the main process.
// Prints to console with an ISO timestamp prefix and appends to
// userData/logs/main.log. Never throws.

function logDir(): string {
  return path.join(app.getPath("userData"), "logs");
}

function logFile(): string {
  return path.join(logDir(), "main.log");
}

let dirReady = false;

function ensureDir(): void {
  if (dirReady) return;
  try {
    fs.mkdirSync(logDir(), { recursive: true });
    dirReady = true;
  } catch {
    // best-effort: if the dir cannot be created, console output still works
  }
}

function format(parts: unknown[]): string {
  return parts
    .map((part) => {
      if (typeof part === "string") return part;
      if (part instanceof Error) return part.stack ?? part.message;
      try {
        return JSON.stringify(part);
      } catch {
        return String(part);
      }
    })
    .join(" ");
}

function write(level: "INFO" | "WARN" | "ERROR", parts: unknown[]): void {
  const line = `${new Date().toISOString()} [${level}] ${format(parts)}`;

  if (level === "ERROR") {
    console.error(line);
  } else if (level === "WARN") {
    console.warn(line);
  } else {
    console.log(line);
  }

  try {
    ensureDir();
    fs.appendFile(logFile(), `${line}\n`, () => {
      // fire-and-forget; ignore write errors
    });
  } catch {
    // never throw from the logger
  }
}

export const log = {
  info(...parts: unknown[]): void {
    write("INFO", parts);
  },
  warn(...parts: unknown[]): void {
    write("WARN", parts);
  },
  error(...parts: unknown[]): void {
    write("ERROR", parts);
  }
};
