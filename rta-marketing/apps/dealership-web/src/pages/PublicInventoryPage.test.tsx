import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NavigationProvider } from "../router/Navigation";
import { LandingPage } from "./LandingPage";
import { PublicInventoryPage } from "./PublicInventoryPage";

const mocks = vi.hoisted(() => ({ api: vi.fn() }));

vi.mock("../lib/api", async () => {
  const actual = await vi.importActual<typeof import("../lib/api")>("../lib/api");
  return { ...actual, api: mocks.api };
});

const listings = Array.from({ length: 8 }, (_, index) => ({
  id: index + 1,
  siteId: index % 3 + 1,
  siteName: ["Romans International", "Tom Hartley", "Redline Specialist Cars"][index % 3],
  title: `2024 Ferrari Roma ${index + 1}`,
  price: "£189,000",
  year: "2024",
  mileage: "3,200 miles",
  city: "London",
  listingUrl: `https://example.com/cars/${index + 1}`,
  thumbnailUrl: null,
  scrapedAt: "2026-09-17T12:00:00.000Z",
}));

const response = {
  data: {
    items: listings,
    sources: [
      { id: 1, name: "Romans International", siteKey: "romans-international" },
      { id: 2, name: "Tom Hartley", siteKey: "tom-hartley" },
      { id: 3, name: "Redline Specialist Cars", siteKey: "redline-specialist-cars" },
    ],
  },
  page: { limit: 24, offset: 0, total: 8, hasMore: false },
};

function renderPage(page: ReactNode) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchInterval: false } } });
  const view = render(<QueryClientProvider client={queryClient}><NavigationProvider>{page}</NavigationProvider></QueryClientProvider>);
  return { ...view, queryClient };
}

afterEach(() => {
  cleanup();
  mocks.api.mockReset();
});

describe("public live inventory", () => {
  it("shows featured vehicle-card loaders while landing inventory is loading", () => {
    mocks.api.mockReturnValue(new Promise(() => undefined));
    const { container, queryClient } = renderPage(<LandingPage />);

    expect(screen.getByRole("status", { name: "Loading vehicle listings" })).toBeInTheDocument();
    expect(container.querySelectorAll(".public-vehicle-skeleton")).toHaveLength(8);
    queryClient.clear();
  });

  it("shows browse-card loaders while public inventory is loading", () => {
    mocks.api.mockReturnValue(new Promise(() => undefined));
    const { container, queryClient } = renderPage(<PublicInventoryPage />);

    expect(screen.getByRole("status", { name: "Loading vehicle listings" })).toBeInTheDocument();
    expect(container.querySelectorAll(".public-vehicle-skeleton")).toHaveLength(9);
    queryClient.clear();
  });

  it("shows real API listings and routes compare actions through sign-in", async () => {
    mocks.api.mockResolvedValue(response);
    const { queryClient } = renderPage(<PublicInventoryPage />);

    expect(await screen.findByText("2024 Ferrari Roma 1")).toBeInTheDocument();
    expect(screen.getAllByText("Romans International").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Sign in to compare" })).toHaveAttribute("href", "/login?next=%2Finventory");
    expect(screen.getAllByRole("link", { name: /Sign in to compare 2024 Ferrari Roma/ })).toHaveLength(8);
    expect(screen.getAllByRole("link", { name: "Open listing" })).toHaveLength(8);
    queryClient.clear();
  });

  it("sends public filters to the anonymous listings endpoint", async () => {
    mocks.api.mockResolvedValue(response);
    const user = userEvent.setup();
    const { queryClient } = renderPage(<PublicInventoryPage />);
    await screen.findByText("2024 Ferrari Roma 1");
    await user.selectOptions(screen.getByLabelText("Source"), "tom-hartley");

    await waitFor(() => expect(mocks.api).toHaveBeenLastCalledWith(expect.stringContaining("siteKey=tom-hartley")));
    queryClient.clear();
  });

  it("shows eight current API records in the landing-page featured section", async () => {
    mocks.api.mockResolvedValue(response);
    const { container, queryClient } = renderPage(<LandingPage />);

    expect(await screen.findByText("2024 Ferrari Roma 1")).toBeInTheDocument();
    expect(container.querySelectorAll(".landing-vehicle-cards .public-vehicle-card")).toHaveLength(8);
    expect(screen.getByRole("link", { name: "View more vehicles" })).toHaveAttribute("href", "/inventory");
    expect(screen.queryByText(/AutoTrader Canada|demo only|Sanitized preview data/i)).not.toBeInTheDocument();
    queryClient.clear();
  });
});
