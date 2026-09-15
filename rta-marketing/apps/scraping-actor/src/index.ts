import { Actor } from "apify";
import { closeDatabase, persistScrapedItems, verifyDatabase } from "@rta/db";
import { loadBaseScraperConfig, logger } from "@rta/shared";
import { scrapeSite } from "@rta/scrapers";
import { runActorScrape } from "./run.js";

async function main(): Promise<void> {
  await Actor.init();
  let exitCode = 0;
  try {
    const config = loadBaseScraperConfig();
    const input = await Actor.getInput();
    const output = await runActorScrape(input, config, { verifyDatabase, scrapeSite, persistScrapedItems });
    await Actor.setValue("OUTPUT", output);
    logger.info({ site: output.siteKey, requestedCount: output.requestedCount, foundCount: output.foundCount }, "Apify scrape completed");
  } catch (error) {
    exitCode = 1;
    logger.error({ message: error instanceof Error ? error.message : "unknown actor failure" }, "Apify scrape failed");
  } finally {
    await closeDatabase().catch((error: unknown) => {
      exitCode = 1;
      logger.error({ message: error instanceof Error ? error.message : "database close failed" }, "Apify database shutdown failed");
    });
    await Actor.exit({ exitCode });
  }
}

void main();
