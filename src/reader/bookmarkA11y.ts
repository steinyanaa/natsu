export function bookmarkSelectionLabel(label: string, selected: boolean): string {
  const safeLabel = label.trim() || "未命名书签";
  return `${selected ? "取消选择" : "选择"}书签：${safeLabel}`;
}

export function selectedBookmarksSummary(count: number): string {
  return count > 0 ? `已选择 ${count} 项` : "";
}
