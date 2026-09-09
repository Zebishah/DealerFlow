import { Queue } from "bullmq";
import { createRedisConnectionConfig, loadConfig } from "@rta/shared";

const config = loadConfig();
const requestedSite = process.argv.slice(2).find((argument) => argument.startsWith("--site="))?.slice("--site=".length);
const requestedLimitValue = process.argv.slice(2).find((argument) => argument.startsWith("--limit="))?.slice("--limit=".length);
const requestedLimit = requestedLimitValue === undefined
  ? config.SCRAPE_DEFAULT_LIMIT
  : Math.min(Math.max(Math.trunc(Number(requestedLimitValue)), 1), config.SCRAPE_MAX_LIMIT);

if (!Number.isFinite(requestedLimit)) throw new Error("--limit must be a number");
if (!requestedSite) throw new Error("--site=<site-key> is required; only one source may run per job");

if (requestedSite && !config.sites.some((site) => site.key === requestedSite)) {
  throw new Error(`Unknown site '${requestedSite}'. Configured sites: ${config.sites.map((site) => site.key).join(", ")}`);
}

const connection = createRedisConnectionConfig(config);
const queue = new Queue("vehicle-scrape", { connection });
const activeJobs = await queue.getJobs(["waiting", "active", "delayed", "prioritized", "paused"], 0, 0);
if (activeJobs.length) throw new Error(`A scrape is already queued or running (${activeJobs[0]?.id ?? "unknown job"}). Wait for it to finish.`);

const jobId = `manual-${requestedSite}`;
const previousJob = await queue.getJob(jobId);
if (previousJob) await previousJob.remove();
const job = await queue.add(`manual-${requestedSite}`, {
  type: "scrape-all-sites",
  limit: requestedLimit,
  siteKey: requestedSite,
}, { jobId, attempts: 3, backoff: { type: "exponential", delay: 5_000 }, removeOnComplete: { count: 100 }, removeOnFail: { count: 100 } });

console.log(`Queued scrape job ${job.id} for ${requestedSite} with limit ${requestedLimit}. Watch: docker compose logs -f worker`);
await queue.close();
