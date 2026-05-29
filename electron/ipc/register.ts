import { registerLibraryHandlers } from "./handlers/library.js";
import { registerOnlineHandlers } from "./handlers/online.js";
import { registerPreferencesHandlers } from "./handlers/preferences.js";
import { registerCoversHandlers } from "./handlers/covers.js";
import { registerSystemHandlers } from "./handlers/system.js";
import { registerZlibHandlers } from "./handlers/zlib.js";

export function registerIpc(): void {
  registerLibraryHandlers();
  registerOnlineHandlers();
  registerPreferencesHandlers();
  registerCoversHandlers();
  registerSystemHandlers();
  registerZlibHandlers();
}
