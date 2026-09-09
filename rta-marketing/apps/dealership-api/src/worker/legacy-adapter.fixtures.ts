import type { SourceKey } from "../contracts/scrape.js";

export interface LegacyAdapterFixture {
  source: SourceKey;
  record: Record<string, unknown>;
  expected: {
    externalId: string;
    make: string;
    model: string;
    year: number;
    condition: "new" | "used";
  };
}

/** Representative records captured at the legacy-parser output boundary. */
export const legacyAdapterFixtures: LegacyAdapterFixture[] = [
  {
    source: "autotrader",
    record: {
      adId: "at-fixture-001",
      title: "2022 Honda Civic Touring",
      link: "https://www.autotrader.ca/a/honda/civic/fixture-001",
      year: "2022",
      make: "Honda",
      model: "Civic",
      price: "$28,990",
      odometer: "41.2k km",
      isUsed: true,
    },
    expected: { externalId: "at-fixture-001", make: "Honda", model: "Civic", year: 2022, condition: "used" },
  },
  {
    source: "autoplanet",
    record: {
      stockNumber: "ap-fixture-002",
      title: "2023 Mazda CX-5 GT",
      url: "https://www.autoplanet.ca/used/mazda-cx-5/fixture-002",
      year: 2023,
      make: "Mazda",
      model: "CX-5",
      price: "$34,980.50",
      odometer: "27,400 km",
      isUsed: true,
    },
    expected: { externalId: "ap-fixture-002", make: "Mazda", model: "CX-5", year: 2023, condition: "used" },
  },
  {
    source: "humberview",
    record: {
      vin: "WVWZZZ1KZPW000003",
      title: "2024 Volkswagen Golf GTI Performance",
      link: "https://www.humberviewvw.com/inventory/golf-gti/fixture-003",
      year: 2024,
      make: "Volkswagen",
      model: "Golf GTI",
      price: "$43,895",
      odometer: "6,200 km",
      isUsed: false,
    },
    expected: { externalId: "WVWZZZ1KZPW000003", make: "Volkswagen", model: "Golf GTI", year: 2024, condition: "new" },
  },
  {
    source: "yorkdalevw",
    record: {
      title: "2022 Volkswagen Tiguan Comfortline",
      link: "https://www.yorkdalevw.ca/inventory/tiguan/fixture-004",
      year: 2022,
      make: "Volkswagen",
      model: "Tiguan",
      price: "$32,995",
      odometer: "38,800 km",
      isUsed: true,
    },
    expected: { externalId: "034c2d54b703c1663094e9f78ea33584", make: "Volkswagen", model: "Tiguan", year: 2022, condition: "used" },
  },
];
