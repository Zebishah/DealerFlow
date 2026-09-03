const siteConfig = require("../../config/sites/autoplanet");

const buildUrl = (filters = {}) => {
  const {
    minPrice,
    maxPrice,
    maxYear,
    minYear,
    make,
    model,
    bodyStyle,
    keywords = "",
    exteriorColor,
    transmission,
    minMileage,
    maxMileage,
    vehicleType = "Passenger Vehicles",
    sort = "price,asc",
    view = "grid",
  } = filters;

  const params = new URLSearchParams();

  // Base query params (always required)
  params.set("qs", keywords);
  params.set("fn", "");

  // Price range
  if (minPrice != null && maxPrice != null) {
    params.set("pr", `${minPrice},${maxPrice}`);
  }

  // Make and Model
  if (make) params.set("mk", make);
  if (model) params.set("md", model);

  // Trim (always empty in your example)
  params.set("tr", "");

  // Body Style
  if (bodyStyle) params.set("bs", bodyStyle);

  // Odometer/Mileage range
  if (minMileage != null && maxMileage != null) {
    params.set("od", `${minMileage},${maxMileage}`);
  }

  // Year range
  if (minYear != null && maxYear != null) {
    params.set("yr", `${minYear},${maxYear}`);
  }

  // Vehicle type
  params.set("v1", vehicleType);

  // Sort and view
  params.set("st", sort);
  params.set("view", view);

  // Exterior color
  if (exteriorColor) params.set("ec", exteriorColor);

  // Transmission
  if (transmission) params.set("tm", transmission);

  return `${siteConfig.baseUrl}/vehicles/?${params.toString()}`;
};

module.exports = { buildUrl };
