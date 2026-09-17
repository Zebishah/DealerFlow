import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ScrapingResultsPage } from "./ScrapingResultsPage";

const mocks = vi.hoisted(() => ({ role: "admin", api: vi.fn() }));

vi.mock("../auth/AuthContext", () => ({
  useAuth: () => ({ user: { role: mocks.role } }),
}));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, api: mocks.api };
});

const liveSites = [
  { id: 1, name: "Romans International", baseUrl: "https://www.romansinternational.com/used/cars/", itemCount: 0, lastScrapedAt: null, siteKey: "romans-international", triggerable: true, executionProvider: "apify" },
  { id: 2, name: "Tom Hartley", baseUrl: "https://www.tomhartley.com/used/", itemCount: 0, lastScrapedAt: null, siteKey: "tom-hartley", triggerable: true, executionProvider: "apify" },
  { id: 3, name: "Redline Specialist Cars", baseUrl: "https://redlinespecialistcars.co.uk/cars/", itemCount: 0, lastScrapedAt: null, siteKey: "redline-specialist-cars", triggerable: true, executionProvider: "apify" },
];

const resultsResponse = {
  data: { items: [], sites: [...liveSites, { id: 4, name: "PakWheels", baseUrl: "https://www.pakwheels.com/", itemCount: 0, lastScrapedAt: null, siteKey: "pakwheels", triggerable: false, executionProvider: "legacy" }] },
  page: { limit: 48, offset: 0, total: 0, hasMore: false },
};
const statusResponse = { data: { serviceStatus: "available", activeJob: null, defaultLimit: 5, maxLimit: 10 } };

function renderPage(role: string) {
  mocks.role = role;
  mocks.api.mockImplementation((path: string) => Promise.resolve(path === "/scraping-results/status" ? statusResponse : resultsResponse));
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  const view = render(<QueryClientProvider client={queryClient}><ScrapingResultsPage /></QueryClientProvider>);
  return { ...view, queryClient };
}

afterEach(() => {
  cleanup();
  mocks.api.mockReset();
});

describe("ScrapingResultsPage source capabilities", () => {
  it.each(["admin", "operator", "recruiter"])("enables all three backend-approved sources for %s", async (role) => {
    const { queryClient } = renderPage(role);
    const scrapeButtons = await screen.findAllByRole("button", { name: "Scrape now" });
    expect(scrapeButtons).toHaveLength(3);
    for (const button of scrapeButtons) expect(button).toBeEnabled();
    expect(screen.getAllByText("connected")).toHaveLength(3);
    queryClient.clear();
  });

  it("keeps legacy sources reference-only and non-triggerable for viewers", async () => {
    const { queryClient } = renderPage("viewer");
    const scrapeButtons = await screen.findAllByRole("button", { name: "Scrape now" });
    expect(scrapeButtons).toHaveLength(3);
    for (const button of scrapeButtons) expect(button).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reference only" })).toBeDisabled();
    expect(screen.getByText("reference")).toBeInTheDocument();
    queryClient.clear();
  });

  it("requests the full allowed ten vehicles when starting a scrape", async () => {
    const { queryClient } = renderPage("admin");
    const [romansButton] = await screen.findAllByRole("button", { name: "Scrape now" });
    fireEvent.click(romansButton!);
    await waitFor(() => expect(mocks.api).toHaveBeenCalledWith("/scraping-results/1/trigger", {
      method: "POST",
      body: JSON.stringify({ limit: 10 }),
    }));
    queryClient.clear();
  });
});
