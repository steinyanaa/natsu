import { hexFromArgb, sourceColorFromImage } from "@material/material-color-utilities";

const seedCache = new Map<string, string>();

export async function extractSeedFromImage(url: string): Promise<string | undefined> {
  if (!url) return undefined;
  const cached = seedCache.get(url);
  if (cached) return cached;
  try {
    const image = await loadImage(url);
    const argb = await sourceColorFromImage(image);
    const hex = hexFromArgb(argb);
    seedCache.set(url, hex);
    return hex;
  } catch {
    return undefined;
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("cover image load failed"));
    image.src = url;
  });
}
