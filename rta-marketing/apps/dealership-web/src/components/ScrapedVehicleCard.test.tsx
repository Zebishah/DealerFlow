import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ScrapedListing } from "../types/domain";
import { ScrapedVehicleCard } from "./ScrapedVehicleCard";

const item: ScrapedListing = {
  id: 1,
  siteId: 1,
  siteName: "Romans International",
  title: "Ferrari 812 Competizione",
  price: "Under offer",
  year: "2022",
  mileage: "1,552",
  city: null,
  listingUrl: "https://www.romansinternational.com/used/cars/ferrari/812-competizione/--4832",
  thumbnailUrl: "https://images.67degreescdn.co.uk/JjqPOdbaoTubncLAH021zfoHvPM=/399x269/smart/137/3/676546/03dfb84c37ccaa5c6195_0s2a6845.jpg",
  scrapedAt: "2026-09-17T00:00:00.000Z",
};

describe("ScrapedVehicleCard image delivery", () => {
  it("loads a Romans image directly first and falls back to the API proxy", () => {
    render(<ScrapedVehicleCard item={item} />);

    const directImage = screen.getByRole("img", { name: item.title });
    expect(directImage).toHaveAttribute("src", item.thumbnailUrl);

    fireEvent.error(directImage);
    expect(screen.getByRole("img", { name: item.title }).getAttribute("src"))
      .toContain("/scraping-results/image?url=");
  });
});
