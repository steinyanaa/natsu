export function readerToastA11y(actionLabel?: string): {
  role: "status";
  ariaLive: "polite";
  ariaAtomic: true;
  actionAriaLabel?: string;
} {
  const safeAction = actionLabel?.trim();
  return {
    role: "status",
    ariaLive: "polite",
    ariaAtomic: true,
    actionAriaLabel: safeAction ? `执行通知操作：${safeAction}` : undefined
  };
}
