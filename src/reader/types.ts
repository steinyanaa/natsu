import type { ReaderProgress } from "../types";

export type ReaderLocation =
  | { kind: "epub"; chapterId: string; anchorId?: string; cfi?: string; percent: number }
  | { kind: "text"; percent: number }
  | { kind: "pdf"; pageIndex: number; yOffset: number; percent: number }
  | { kind: "comic"; pageIndex: number; yOffset: number; percent: number };

export interface ReaderEngine<TDocument = unknown> {
  load(): Promise<TDocument>;
  getLocation(): ReaderLocation;
  restoreLocation(location: ReaderLocation): void;
  dispose(): void;
}

export type JumpRequest = { progress: ReaderProgress; token: number };
export type AnchorJumpRequest = { targetId: string; token: number };
