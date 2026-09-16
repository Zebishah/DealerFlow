import assert from "node:assert/strict";
import test from "node:test";
import { runQueueBackedCrawler, type QueueBackedCrawler, type QueueLike } from "./cheerio-runtime.js";

test("Cheerio runtime consumes dynamically queued URLs from its active RequestQueue", async () => {
  const sitemapUrl = "https://fixture.test/sitemap.xml";
  const detailUrl = "https://fixture.test/used-car-details/one/";
  const pending: string[] = [];
  const processed: string[] = [];
  const queue: QueueLike = { addRequest: async ({ url }) => { pending.push(url); } };
  const crawler: QueueBackedCrawler = {
    run: async (requests) => {
      assert.equal(requests, undefined);
      while (pending.length > 0) {
        const url = pending.shift()!;
        processed.push(url);
        if (url === sitemapUrl) await queue.addRequest({ url: detailUrl });
      }
    },
    teardown: async () => undefined,
  };
  await runQueueBackedCrawler(crawler, queue, [sitemapUrl], 1_000);
  assert.deepEqual(processed, [sitemapUrl, detailUrl]);
});
