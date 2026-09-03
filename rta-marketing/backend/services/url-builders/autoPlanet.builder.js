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

  // ✅ Base query params required by site
  params.set("qs", keywords);
  params.set("fn", "");

  if (minPrice != null && maxPrice != null)
    params.set("pr", `${minPrice},${maxPrice}`);

  if (make) params.set("mk", make);
  if (model) params.set("md", model);
  params.set("tr", ""); // ✅ trim always exists, empty if none

  if (bodyStyle) params.set("bs", bodyStyle);

  // ✅ Build odometer from minMileage and maxMileage
  if (minMileage != null && maxMileage != null) {
    params.set("od", `${minMileage},${maxMileage}`);
  } else {
    params.set("od", ""); // ✅ empty if no mileage range
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
