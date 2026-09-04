const siteConfig = require("../../config/sites/autoplanet");

const buildUrl = (filters = {}) => {
  const {
    minPrice,
    maxPrice,
    minYear,
    maxYear,
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

  // Base query parameters required by the source.
  params.set("qs", keywords);
  params.set("fn", "");

  if (minPrice != null && maxPrice != null)
    params.set("pr", `${minPrice},${maxPrice}`);

  if (make) params.set("mk", make);
  if (model) params.set("md", model);
  params.set("tr", "");

  if (bodyStyle) params.set("bs", bodyStyle);

  // Build the odometer range when both bounds are present.
  if (minMileage != null && maxMileage != null) {
    params.set("od", `${minMileage},${maxMileage}`);
  } else {
    params.set("od", "");
  }

  if (minYear != null && maxYear != null) {
    params.set("yr", `${minYear},${maxYear}`);
  }

  params.set("v1", vehicleType);
  params.set("st", sort);
  params.set("view", view);

  if (exteriorColor) params.set("ec", exteriorColor);
  if (transmission) params.set("tm", transmission);

  return `${siteConfig.baseUrl}/vehicles/?${params.toString()}`;
};

module.exports = { buildUrl };
