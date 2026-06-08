export function segmentedOptionA11y(
  optionValue: string,
  currentValue: string,
  optionIndex: number,
  activeIndex: number
): { ariaChecked: boolean; tabIndex: 0 | -1 } {
  return {
    ariaChecked: optionValue === currentValue,
    tabIndex: optionIndex === activeIndex ? 0 : -1
  };
}

export function segmentedControlLabel(label?: string): string {
  return label?.trim() || "选项";
}
