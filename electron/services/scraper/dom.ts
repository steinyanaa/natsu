import type { HTMLElement } from "node-html-parser";
import type { BookFormat, HtmlSourceConfig } from "../../ipc/types.js";

export function resultArrayFromCustomPayload(payload: unknown): unknown[] {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (!payload || typeof payload !== "object") {
    return [];
  }

  const object = payload as Record<string, unknown>;
  const candidates = [object.results, object.items, object.books, object.data];
  return candidates.find(Array.isArray) as unknown[] | undefined ?? [];
}

export function stringField(item: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = item[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return undefined;
}

export function valueByPath(input: unknown, pathValue?: string): unknown {
  if (!pathValue || !pathValue.trim()) {
    return undefined;
  }

  return pathValue.split(".").reduce<unknown>((current, segment) => {
    if (!segment) {
      return current;
    }

    if (Array.isArray(current)) {
      const index = Number.parseInt(segment, 10);
      return Number.isInteger(index) ? current[index] : undefined;
    }

    if (current && typeof current === "object") {
      return (current as Record<string, unknown>)[segment];
    }

    return undefined;
  }, input);
}

export function normalizeSubjects(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && Boolean(item.trim())).slice(0, 6);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[|,/]/)
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 6);
  }

  return [];
}

export function resolveUrl(baseUrl: string, value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  try {
    const url = new URL(value.trim(), baseUrl);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

export function selectedElement(root: HTMLElement, selector?: string): HTMLElement | undefined {
  if (!selector) {
    return root;
  }

  try {
    if (root.matches(selector)) {
      return root;
    }
  } catch {
    // Some selector lists may be unsupported by the parser. Fall back to querySelector.
  }

  return root.querySelector(selector) ?? undefined;
}

export function selectedText(root: HTMLElement, selector?: string): string | undefined {
  const element = selectedElement(root, selector);
  const text = element?.textContent?.replace(/\s+/g, " ").trim();
  return text || undefined;
}

export function attrCandidates(value: string | undefined, fallback: string[]): string[] {
  const explicit = value
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return explicit?.length ? explicit : fallback;
}

export function selectedAttr(root: HTMLElement, selector: string | undefined, attr: string | undefined, fallback: string[]): string | undefined {
  const element = selectedElement(root, selector);
  if (!element) {
    return undefined;
  }

  for (const candidate of attrCandidates(attr, fallback)) {
    const value = element.getAttribute(candidate)?.trim();
    if (value) {
      return value;
    }
  }

  return undefined;
}

export function hrefFrom(root: HTMLElement, selector?: string, attr?: string): string | undefined {
  return selectedAttr(root, selector, attr, ["href", "src", "data-href", "data-url", "download"]);
}

export function htmlDownloadHeaders(config: HtmlSourceConfig, referer: string): Record<string, string> | undefined {
  const headers = {
    ...(config.headers ?? {}),
    ...(config.downloadHeaders ?? {})
  };
  const hasReferer = Object.keys(headers).some((key) => key.toLowerCase() === "referer");

  if (!hasReferer) {
    headers.Referer = referer;
  }

  return Object.keys(headers).length ? headers : undefined;
}

export function importabilityReason(downloadUrl?: string, format?: BookFormat): string | undefined {
  if (!downloadUrl) {
    return "?????????";
  }

  if (!format) {
    return "??????????????????????????? format??? epub";
  }

  return undefined;
}
