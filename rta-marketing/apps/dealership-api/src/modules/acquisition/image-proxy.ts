import { AppError } from "../../lib/errors.js";
import { isApprovedImageHost, sourcePageRefererForImageHost } from "./source-mapping.js";

const redirectStatuses = new Set([301, 302, 303, 307, 308]);
const maxRedirects = 3;

function validateTarget(target: URL): void {
  if (!/^https?:$/.test(target.protocol) || target.username || target.password) {
    throw new AppError(400, "INVALID_IMAGE_URL", "Only public HTTP image URLs are supported");
  }
  if (!isApprovedImageHost(target.hostname)) {
    throw new AppError(403, "IMAGE_HOST_NOT_ALLOWED", "This image host is not an approved inventory source");
  }
}

export async function fetchApprovedSourceImage(rawUrl: string, fetchImpl: typeof fetch = fetch): Promise<Response> {
  let target: URL;
  try {
    target = new URL(rawUrl);
  } catch {
    throw new AppError(400, "INVALID_IMAGE_URL", "A valid image URL is required");
  }
  validateTarget(target);

  for (let redirects = 0; redirects <= maxRedirects; redirects += 1) {
    let upstream: Response;
    const referer = sourcePageRefererForImageHost(target.hostname, target.protocol);
    const isRomansImage = referer === "https://www.romansinternational.com/";
    try {
      upstream = await fetchImpl(target, {
        headers: {
          Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
          Referer: referer,
          "User-Agent": isRomansImage
            ? "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"
            : "Mozilla/5.0 (compatible; RTA Inventory/1.0)",
        },
        redirect: "manual",
        signal: AbortSignal.timeout(12_000),
      });
    } catch {
      throw new AppError(502, "SOURCE_IMAGE_UPSTREAM_UNAVAILABLE", "The source image could not be reached");
    }

    if (!redirectStatuses.has(upstream.status)) {
      if (!upstream.ok) throw new AppError(404, "SOURCE_IMAGE_UNAVAILABLE", "The source image is no longer available");
      return upstream;
    }
    if (redirects === maxRedirects) throw new AppError(502, "SOURCE_IMAGE_REDIRECT_LIMIT", "The source image redirected too many times");

    const location = upstream.headers.get("location");
    if (!location) throw new AppError(502, "SOURCE_IMAGE_REDIRECT_INVALID", "The source returned an invalid image redirect");
    try {
      target = new URL(location, target);
    } catch {
      throw new AppError(502, "SOURCE_IMAGE_REDIRECT_INVALID", "The source returned an invalid image redirect");
    }
    validateTarget(target);
  }

  throw new AppError(502, "SOURCE_IMAGE_REDIRECT_LIMIT", "The source image redirected too many times");
}
