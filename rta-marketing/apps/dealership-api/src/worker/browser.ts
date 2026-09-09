import puppeteer, { type Browser, type LaunchOptions } from "puppeteer-core";
import { workerEnv } from "../config/worker-env.js";
import { AppError } from "../lib/errors.js";

function runningInLambda(): boolean {
  return Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.AWS_EXECUTION_ENV?.startsWith("AWS_Lambda"));
}

export async function launchScraperBrowser(): Promise<Browser> {
  const inLambda = runningInLambda();
  let executablePath = workerEnv.BROWSER_EXECUTABLE_PATH;
  let chromiumArgs: string[] = [];

  if (inLambda) {
    const chromiumModule = await import("@sparticuz/chromium");
    const chromium = chromiumModule.default;
    executablePath = await chromium.executablePath();
    chromiumArgs = chromium.args;
  }

  if (!executablePath) {
    throw new AppError(
      503,
      "BROWSER_EXECUTABLE_REQUIRED",
      "BROWSER_EXECUTABLE_PATH is required outside AWS Lambda",
      { retryable: false },
    );
  }
  const options: LaunchOptions = {
    executablePath,
    headless: true,
    args: [
      ...chromiumArgs,
      "--disable-dev-shm-usage",
      ...(workerEnv.BROWSER_DISABLE_SANDBOX
        ? ["--no-sandbox", "--disable-setuid-sandbox"]
        : []),
    ],
  };
  return puppeteer.launch(options);
}
