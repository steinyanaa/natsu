import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { IPC_CHANNELS } from "./channels";

const require = createRequire(import.meta.url);

describe("IPC channel sources", () => {
  it("keeps the preload CJS channel map synchronized with the TypeScript map", () => {
    const cjs = require("./channels.cjs") as { IPC_CHANNELS: typeof IPC_CHANNELS };

    expect(cjs.IPC_CHANNELS).toEqual(IPC_CHANNELS);
  });
});
