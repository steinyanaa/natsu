export function targetIdFromHashHref(href: string | undefined): string | undefined {
  if (!href?.startsWith("#")) {
    return undefined;
  }

  return href.slice(1) || undefined;
}

export function resolveExistingTargetId(targetId: string | undefined, existingIds: Set<string>): string | undefined {
  if (!targetId) {
    return undefined;
  }

  if (existingIds.has(targetId)) {
    return targetId;
  }

  const chapterPrefix = targetId.includes("__") ? targetId.slice(0, targetId.indexOf("__")) : targetId;
  return existingIds.has(chapterPrefix) ? chapterPrefix : undefined;
}
