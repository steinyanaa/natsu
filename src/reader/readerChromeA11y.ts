export function shouldRevealChromeOnFocus(controlsVisible: boolean, readerPanelOpen: boolean): boolean {
  return !controlsVisible && !readerPanelOpen;
}
