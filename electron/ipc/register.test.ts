import { describe, expect, it, vi, beforeEach } from "vitest";
import { IPC_CHANNELS } from "./channels";

describe("ipc/register contract", () => {
  let handlers: Map<string, Function>;
  let mockIpcMain: { handle: ReturnType<typeof vi.fn>; on: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.resetModules();
    handlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        if (handlers.has(channel)) {
          throw new Error(`Channel ${channel} registered twice`);
        }
        handlers.set(channel, handler);
      }),
      on: vi.fn()
    };
    vi.doMock("electron", () => ({
      ipcMain: mockIpcMain,
      app: {
        getPath: () => "/tmp",
        getName: () => "natsu",
        getVersion: () => "1.4.0",
        isPackaged: false,
        whenReady: () => Promise.resolve(),
        getLocale: () => "en-US"
      },
      BrowserWindow: class { static getAllWindows() { return []; } },
      shell: { openExternal: vi.fn() },
      session: { fromPartition: vi.fn(() => ({ cookies: { get: vi.fn(() => Promise.resolve([])) } })) },
      protocol: { handle: vi.fn(), registerSchemesAsPrivileged: vi.fn() },
      net: { fetch: vi.fn() },
      dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() }
    }));
  });

  it("registers exactly one handler per channel in IPC_CHANNELS", async () => {
    // Registration only wires ipcMain.handle(channel, fn); handler bodies
    // (and their getStore() calls) are never invoked here, so the store does
    // not need to be initialized for this topology check.
    const { registerIpc } = await import("./register");
    registerIpc();

    const expectedChannels = Object.values(IPC_CHANNELS);
    for (const channel of expectedChannels) {
      expect(handlers.has(channel)).toBe(true);
    }
    expect(handlers.size).toBe(expectedChannels.length);
  });
});
