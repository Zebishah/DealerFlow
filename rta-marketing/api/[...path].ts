// Vercel deployment adapter. The scraping UI lives under apps/scraping-web,
// while Vercel discovers serverless functions from the configured project root.
export { default } from "../apps/scraping-web/api/[...path]";
