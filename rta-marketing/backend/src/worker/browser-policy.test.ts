import assert from "node:assert/strict";
import test from "node:test";
import { proxyServer, safePageUrl, sourceDelay } from "./browser-policy.js";

void test("jitter never reduces the minimum source delay", () => {
  assert.equal(sourceDelay(1500, 500, () => 0), 1500);
  assert.equal(sourceDelay(1500, 500, () => 0.9999), 2000);
  assert.equal(sourceDelay(1500, 0, () => 0.5), 1500);
});
void test("diagnostic URLs strip credentials, query strings and fragments", () => {
  assert.equal(safePageUrl("https://user:secret@dealer.example/inventory/?token=secret#secret"), "https://dealer.example/inventory/");
});
void test("proxy accepts origins, but rejects embedded secrets and unsupported schemes", () => {
  assert.equal(proxyServer("http://proxy.example:8080"), "http://proxy.example:8080");
  assert.equal(proxyServer(undefined), undefined);
  for (const value of ["http://user:pass@proxy.example", "file:///tmp/proxy", "https://proxy.example/path", "http://proxy.example/?secret=1"]) {
    assert.throws(() => proxyServer(value));
  }
});
