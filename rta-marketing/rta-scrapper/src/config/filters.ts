// ============================================
// FILE: src/config/filters.ts
// ============================================

import { FilterConfig } from "../types";

export const FILTERS: FilterConfig[] = [
  {
    key: "keywords",
    label: "Search",
    type: "text",
    placeholder: "Search by keyword (e.g. Acura, Honda...)",
  },
  {
    key: "make",
    label: "Make",
    type: "select",
    options: "from-makes-json",
    placeholder: "Any Make",
  },
  {
    key: "model",
    label: "Model",
    type: "select",
    options: "from-selected-make",
    placeholder: "Any Model",
    dependsOn: "make",
  },
  // {
  //   key: "bodyStyle",
  //   label: "Body Style",
  //   type: "text",
  //   placeholder: "SUV, Sedan...",
  // },
  { key: "minPrice", label: "Min Price", type: "number" },
  { key: "maxPrice", label: "Max Price", type: "number" },
  { key: "minMileage", label: "Min KM", type: "number" },
  { key: "maxMileage", label: "Max KM", type: "number" },
  { key: "minYear", label: "Min Year", type: "number", min: 1900 },
  { key: "maxYear", label: "Max Year", type: "number", max: 2030 },
  {
    key: "exteriorColor",
    label: "Color",
    type: "select",
    options: [
      "Beige",
      "Black",
      "Blue",
      "Bronze",
      "Brown",
      "Gold",
      "Green",
      "Grey",
      "Orange",
      "Other",
      "Red",
      "Silver",
      "White",
      "Yellow",
    ],
  },
  {
    key: "transmission",
    label: "Transmission",
    type: "select",
    options: ["Automatic", "Manual"],
  },
  {
    key: "postal",
    label: "Postal Code",
    type: "text",
    required: true,
    default: "A1A1A1",
  },
  {
    key: "radius",
    label: "Radius (km)",
    type: "select",
    options: [25, 50, 100, 200, 500],
    default: 100,
  },
];
