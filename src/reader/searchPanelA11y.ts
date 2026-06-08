export function searchResultCountLabel(count: number): string {
  return count > 0 ? `${count} 个结果` : "";
}

export function searchResultOptionId(index: number): string {
  return `search-result-${Math.max(0, Math.floor(index))}`;
}

export function activeSearchResultId(resultCount: number, activeIndex: number): string | undefined {
  if (resultCount <= 0) {
    return undefined;
  }

  const safeIndex = Math.min(Math.max(0, Math.floor(activeIndex)), resultCount - 1);
  return searchResultOptionId(safeIndex);
}
