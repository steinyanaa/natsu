import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../channels.js";
import {
  getStore,
  defaultPreferences,
  migratePreferences,
  normalizePreferences
} from "../../services/store.js";
import type { ReaderPreferences } from "../types.js";

export function registerPreferencesHandlers(): void {
  ipcMain.handle(IPC_CHANNELS.preferencesGet, () => {
    const userPrefs = getStore().get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs };
    const preferences = normalizePreferences(migratePreferences(merged));
    getStore().set("preferences", preferences);
    return preferences;
  });

  ipcMain.handle(IPC_CHANNELS.preferencesSave, (_event, preferences: Partial<ReaderPreferences>) => {
    const userPrefs = getStore().get("preferences");
    const merged = { ...defaultPreferences(), ...userPrefs, ...preferences };
    const nextPreferences = normalizePreferences(migratePreferences(merged));
    getStore().set("preferences", nextPreferences);
    return nextPreferences;
  });
}
