const romansImageHosts = new Set([
  "romansinternational.com",
  "images.67degrees.co.uk",
  "images.67degreescdn.co.uk",
]);

export function isRomansImageUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return url.protocol === "https:" && romansImageHosts.has(hostname);
  } catch {
    return false;
  }
}
