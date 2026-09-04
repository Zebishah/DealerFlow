// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogVehicle } from "../types/platform";
import { VehicleCard } from "./vehicles";

const vehicle: CatalogVehicle = {
  listingId: "listing-1",
  vehicleId: "vehicle-1",
  externalId: "external-1",
  source: "autotrader",
  sourceName: "AutoTrader",
  title: "2024 Volkswagen Golf GTI",
  make: "Volkswagen",
  model: "Golf GTI",
  trim: "Autobahn",
  year: 2024,
  priceCents: 4_250_000,
  currency: "CAD",
  odometerKm: 12_500,
  imageUrl: null,
  dealerName: "Example Motors",
  location: "Toronto, ON",
  isUsed: true,
  lastSeenAt: "2026-09-04T12:00:00Z",
};

describe("VehicleCard", () => {
  it("renders normalized data and exposes working actions", () => {
    const onSave = vi.fn();
    const onCompare = vi.fn();
    const onView = vi.fn();
    render(<VehicleCard car={vehicle} saved={false} compared={false} onSave={onSave} onCompare={onCompare} onView={onView} />);

    expect(screen.getByRole("heading", { name: "2024 Volkswagen Golf GTI" })).toBeInTheDocument();
    expect(screen.getByText("12,500 km")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save vehicle" }));
    fireEvent.click(screen.getByRole("button", { name: "Compare" }));
    fireEvent.click(screen.getByRole("button", { name: /View intelligence/i }));
    expect(onSave).toHaveBeenCalledOnce();
    expect(onCompare).toHaveBeenCalledOnce();
    expect(onView).toHaveBeenCalledOnce();
  });
});
