const { contextBridge } = require("electron");
const library = require("./groups/library.cjs");
const online = require("./groups/online.cjs");
const preferences = require("./groups/preferences.cjs");
const covers = require("./groups/covers.cjs");
const zlib = require("./groups/zlib.cjs");
const system = require("./groups/system.cjs");

contextBridge.exposeInMainWorld("readerApi", {
  ...library,
  ...online,
  ...preferences,
  ...covers,
  ...zlib,
  ...system
});
