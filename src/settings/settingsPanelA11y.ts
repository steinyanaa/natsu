export function settingsPanelDialogAttributes(open: boolean, labelledBy: string) {
  return {
    role: "dialog" as const,
    "aria-modal": open,
    "aria-hidden": !open,
    "aria-labelledby": labelledBy
  };
}

export function shouldCloseSettingsPanelOnKey(key: string, open: boolean): boolean {
  return open && key === "Escape";
}
