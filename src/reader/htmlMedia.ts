export function imageUrlsFromSrcset(srcset: string): string[] {
  return srcset
    .split(",")
    .map((candidate) => candidate.trim().split(/\s+/)[0])
    .filter(Boolean);
}

export function imageUrlsFromHtml(html: string): string[] {
  const urls = new Set<string>();

  for (const match of html.matchAll(/\b(?:src|href|xlink:href|poster)=["']([^"']+)["']/gi)) {
    urls.add(match[1]);
  }

  for (const match of html.matchAll(/\bsrcset=["']([^"']+)["']/gi)) {
    imageUrlsFromSrcset(match[1]).forEach((url) => urls.add(url));
  }

  html.replace(/url\((['"]?)(.*?)\1\)/gi, (_match, _quote: string, url: string) => {
    if (url) {
      urls.add(url);
    }
    return "";
  });

  return [...urls].filter((url) => /^(?:blob:|data:image\/|https?:)/i.test(url));
}
