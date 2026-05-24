import type { OnlineSource, OnlineSourceKind } from "../types";

const supportedSourceKinds = new Set<OnlineSourceKind>(["url", "json", "html", "gutenberg", "rss"]);

export function defaultCustomSource(index: number): OnlineSource {
  return {
    id: `custom-${Date.now()}-${index}`,
    name: `Custom Source ${index + 1}`,
    enabled: true,
    kind: "url",
    value: ""
  };
}

export function parseSourcePack(text: string, createId: (index: number) => string = (index) => `imported-${Date.now()}-${index}`): OnlineSource[] {
  const trimmed = text.trim();
  if (!trimmed) return [];
  const parsed = JSON.parse(trimmed) as unknown;
  const list = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { sources?: unknown }).sources)
      ? ((parsed as { sources: unknown[] }).sources)
      : [parsed];

  return list
    .map((entry, index) => {
      if (!entry || typeof entry !== "object") return undefined;
      const source = entry as Partial<OnlineSource>;
      if (!source.name || !source.kind || !supportedSourceKinds.has(source.kind)) {
        return undefined;
      }
      return {
        id: source.id || createId(index),
        name: source.name,
        enabled: source.enabled ?? true,
        kind: source.kind,
        value: source.value || ""
      } satisfies OnlineSource;
    })
    .filter((source): source is OnlineSource => Boolean(source));
}
