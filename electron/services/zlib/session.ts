import { session, type Session } from "electron";

export function zlibSession(): Session {
  return session.fromPartition("persist:natsu-zlib");
}

export function isZlibUrl(url: string): boolean {
  return url.includes("z-library") || url.includes("zlibrary");
}
