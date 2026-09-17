import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../lib/errors.js";
import { fetchApprovedSourceImage } from "./image-proxy.js";
import { isApprovedImageHost } from "./source-mapping.js";

void test("Romans image hosts are exact allowlist entries, including the live host and retained historical host", () => {
  assert.equal(isApprovedImageHost("images.67degrees.co.uk"), true);
  assert.equal(isApprovedImageHost("images.67degreescdn.co.uk"), true);
  assert.equal(isApprovedImageHost("romansinternational.com"), true);
  assert.equal(isApprovedImageHost("images.67degrees.co.uk.attacker.com"), false);
});

void test("image proxy follows bounded approved redirects and returns image content with the Romans referer", async () => {
  const requests: Array<{ url: string; init?: RequestInit }> = [];
  const response = await fetchApprovedSourceImage(
    "https://images.67degrees.co.uk/car/ferrari.jpg",
    async (input, init) => {
      const url = String(input);
      requests.push(init ? { url, init } : { url });
      if (requests.length === 1) return new Response(null, { status: 302, headers: { location: "https://images.67degreescdn.co.uk/optimized/ferrari.webp" } });
      return new Response("image-bytes", { status: 200, headers: { "content-type": "image/webp" } });
    },
  );

  assert.equal(await response.text(), "image-bytes");
  assert.equal(response.headers.get("content-type"), "image/webp");
  assert.deepEqual(requests.map((request) => request.url), [
    "https://images.67degrees.co.uk/car/ferrari.jpg",
    "https://images.67degreescdn.co.uk/optimized/ferrari.webp",
  ]);
  const headers = requests[0]?.init?.headers as Record<string, string>;
  assert.equal(headers.Referer, "https://www.romansinternational.com/");
  assert.match(headers["User-Agent"] ?? "", /^Mozilla\/5\.0 .*Chrome\//);
  assert.match(headers.Accept ?? "", /image\/\*/);
  assert.equal(requests[0]?.init?.redirect, "manual");
  assert.equal((requests[1]?.init?.headers as Record<string, string>).Referer, "https://www.romansinternational.com/");
});

void test("image proxy blocks redirects to hosts outside the source allowlist", async () => {
  let requests = 0;
  await assert.rejects(
    fetchApprovedSourceImage("https://images.67degrees.co.uk/car/ferrari.jpg", async () => {
      requests += 1;
      return new Response(null, { status: 302, headers: { location: "https://attacker.example/steal" } });
    }),
    (error: unknown) => error instanceof AppError && error.statusCode === 403 && error.code === "IMAGE_HOST_NOT_ALLOWED",
  );
  assert.equal(requests, 1);
});

void test("image proxy rejects unapproved initial hosts before making a request", async () => {
  let requests = 0;
  await assert.rejects(
    fetchApprovedSourceImage("https://images.67degrees.co.uk.attacker.com/car.jpg", async () => {
      requests += 1;
      return new Response("unexpected", { status: 200 });
    }),
    (error: unknown) => error instanceof AppError && error.statusCode === 403,
  );
  assert.equal(requests, 0);
});

void test("image proxy reports the upstream status instead of disguising it as a missing URL", async () => {
  await assert.rejects(
    fetchApprovedSourceImage("https://images.67degreescdn.co.uk/car.jpg", async () => new Response("denied", { status: 403 })),
    (error: unknown) => error instanceof AppError
      && error.statusCode === 502
      && error.code === "SOURCE_IMAGE_UPSTREAM_REJECTED"
      && (error.details as { upstreamStatus?: number } | undefined)?.upstreamStatus === 403,
  );
});
