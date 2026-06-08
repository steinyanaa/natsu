export function shouldSubmitTextInputDialog({
  key,
  multiline,
  ctrlKey,
  metaKey
}: {
  key: string;
  multiline: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
}): boolean {
  if (key !== "Enter") {
    return false;
  }

  return multiline ? Boolean(ctrlKey || metaKey) : true;
}
