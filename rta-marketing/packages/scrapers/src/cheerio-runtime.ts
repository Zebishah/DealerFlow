import { CheerioCrawler, RequestQueue } from "crawlee";
import type { SiteConfig } from "@rta/shared";
import { assertRobotsAllowed, runCrawlerWithTimeout, type ScraperOptions } from "./common.js";

export interface CheerioPage {
  body: string;
  requestUrl: string;
  finalUrl: string;
  statusCode: number | null;
  addUrl: (url: string) => Promise<void>;
}

/**
 * A single-threaded, bounded Cheerio crawl. Adapters decide which discovered
 * URLs to enqueue; this keeps pagination and discovery policies explicit.
 */
export async function crawlCheerioUrls(
  site: SiteConfig,
  options: ScraperOptions,
  initialUrls: string[],
  maxRequests: number,
  onPage: (page: CheerioPage) => Promise<void>,
): Promise<void> {
  const requestQueue = await RequestQueue.open(`rta-${site.key}-${Date.now()}`);
  const crawler = new CheerioCrawler({
    maxConcurrency: 1,
    requestQueue,
    // Technical failures are retried by the surrounding job runtime. A
    // source-contract error must not be retried as if it were a transient page.
    maxRequestRetries: 0,
    requestHandlerTimeoutSecs: Math.ceil(options.jobTimeoutMs / 1000),
    maxRequestsPerCrawl: maxRequests,
    preNavigationHooks: [async (_context, gotOptions) => {
      gotOptions.headers = {
        ...gotOptions.headers,
        "user-agent": options.userAgent,
        "accept-language": "en-US,en;q=0.8",
      };
    }],
    requestHandler: async ({ body, request, response }) => {
      const requestUrl = request.url;
      await assertRobotsAllowed(site, options.userAgent, requestUrl);
      await onPage({
        body: String(body),
        requestUrl,
        finalUrl: String(response?.url ?? request.loadedUrl ?? requestUrl),
        statusCode: response?.statusCode ?? null,
        addUrl: async (url) => {
          await requestQueue.addRequest({ url });
        },
      });
    },
  });

  try {
    await runCrawlerWithTimeout(crawler, initialUrls[0]!, options.jobTimeoutMs);
  } finally {
    await requestQueue.drop();
  }
}
