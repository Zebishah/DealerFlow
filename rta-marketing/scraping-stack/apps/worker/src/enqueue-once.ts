import { Queue } from "bullmq";
import { createRedisConnectionConfig, loadConfig } from "@rta/shared";

const config = loadConfig();
const requestedSite = process.argv.slice(2).find((argument) => argument.startsWith("--site="))?.slice("--site=".length);

if (requestedSite && !config.sites.some((site) => site.key === requestedSite)) {
  throw new Error(`Unknown site '${requestedSite}'. Configured sites: ${config.sites.map((site) => site.key).join(", ")}`);
}

const connection = createRedisConnectionConfig(config);
const queue = new Queue("vehicle-scrape", { connection });
const job = await queue.add(`manual-${requestedSite ?? "all"}-${Date.now()}`, {
  type: "scrape-all-sites",
  ...(requestedSite ? { siteKey: requestedSite } : {}),
}, { attempts: 1, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } });

console.log(`Queued scrape job ${job.id} for ${requestedSite ?? "all configured sites"}. Watch: docker compose logs -f worker`);
await queue.close();
