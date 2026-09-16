export type ApifySiteKey = "romans-international" | "tom-hartley" | "redline-specialist-cars";
export type ExecutionProvider = "apify" | "legacy" | "reference";

export interface SourceExecutionMetadata {
  siteKey: ApifySiteKey | "pakwheels" | "olx-pakistan" | null;
  triggerable: boolean;
  executionProvider: ExecutionProvider;
}

const liveSources: Record<ApifySiteKey, { baseUrl: string; imageHosts: readonly string[] }> = {
  "romans-international": {
    baseUrl: "https://www.romansinternational.com/used/cars/",
    imageHosts: ["romansinternational.com", "images.67degreescdn.co.uk"],
  },
  "tom-hartley": {
    baseUrl: "https://www.tomhartley.com/used/",
    imageHosts: ["tomhartley.com", "bluesky.cdn.imgeng.in"],
  },
  "redline-specialist-cars": {
    baseUrl: "https://redlinespecialistcars.co.uk/cars/",
    imageHosts: ["redlinespecialistcars.co.uk", "redline.drive-digital.co.uk"],
  },
};

function normalizedUrl(value: string): string | null {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.href;
  } catch {
    return null;
  }
}

function normalizedHost(value: string): string {
  return value.toLowerCase().replace(/^www\./, "");
}

export function sourceExecutionMetadata(baseUrl: string): SourceExecutionMetadata {
  const normalized = normalizedUrl(baseUrl);
  for (const [siteKey, source] of Object.entries(liveSources) as Array<[ApifySiteKey, (typeof liveSources)[ApifySiteKey]]>) {
    if (normalized === normalizedUrl(source.baseUrl)) return { siteKey, triggerable: true, executionProvider: "apify" };
  }
  const host = (() => {
    try { return normalizedHost(new URL(baseUrl).hostname); } catch { return ""; }
  })();
  if (host === "pakwheels.com") return { siteKey: "pakwheels", triggerable: false, executionProvider: "legacy" };
  if (host === "olx.com.pk") return { siteKey: "olx-pakistan", triggerable: false, executionProvider: "legacy" };
  return { siteKey: null, triggerable: false, executionProvider: "reference" };
}

export function apifySiteKeyForBaseUrl(baseUrl: string): ApifySiteKey | null {
  const metadata = sourceExecutionMetadata(baseUrl);
  return metadata.executionProvider === "apify" ? metadata.siteKey as ApifySiteKey : null;
}

export function isApprovedImageHost(hostname: string): boolean {
  const host = normalizedHost(hostname);
  return Object.values(liveSources).some((source) => source.imageHosts.some((allowed) => normalizedHost(allowed) === host));
}

export function sourceImageHosts(): readonly string[] {
  return Object.values(liveSources).flatMap((source) => source.imageHosts);
}

export const APPROVED_APIFY_SITE_KEYS = Object.freeze(Object.keys(liveSources) as ApifySiteKey[]);
