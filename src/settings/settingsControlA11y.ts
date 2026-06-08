export function toggleSettingAriaLabel(label: string, checked: boolean): string {
  const safeLabel = label.trim() || "开关";
  return `${safeLabel}：${checked ? "已开启" : "已关闭"}`;
}
