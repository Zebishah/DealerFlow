const siteConfig = require("../../config/sites/autotrader");

const buildUrl = (filters) => {
  const {
    make,
    model,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    postal,
    minMileage,
    maxMileage,
    transmission,
    exteriorColor,
    bodyStyle,
    radius = 100,
    keywords = "",
  } = filters;

  // Get slugs for province/city
  // const slugs = siteConfig.getSlugs(postal || "A1A1A1");

  // Build path: /cars/make/model/province/city/
  let path = "/cars";
  if (make) path += `/${encodeURIComponent(make.toLowerCase())}`;
  if (model)
    path += `/${encodeURIComponent(model.toLowerCase().replace(/\s+/g, "-"))}`;

  // Province and city ALWAYS come after model (if they exist)
  // if (slugs.province) path += `/${slugs.province}`;
  // if (slugs.city) path += `/${slugs.city}`;

  // Add trailing slash
  path += "/";

  // Build query params
  const params = new URLSearchParams();

  params.append("rcp", "200"); // results per page
  params.append("rcs", "0"); // results start index
  params.append("srt", "39"); // sort

  // Year range
  if (minYear && maxYear) params.append("yRng", `${minYear},${maxYear}`);

  // Price range
  if (minPrice != null && maxPrice != null)
    params.append("pRng", `${minPrice},${maxPrice}`);

  // Mileage range
  if (minMileage != null && maxMileage != null)
    params.append("oRng", `${minMileage},${maxMileage}`);

  // Radius
  params.append("prx", radius.toString());

  // Province name
  // if (slugs.provinceName) params.append("prv", slugs.provinceName);

  // Postal code
  params.append("loc", postal || "A1A1A1");

  // Exterior color
  if (exteriorColor) params.append("clr", exteriorColor);

  // Body style
  if (bodyStyle) params.append("body", bodyStyle);

  // Transmission
  if (transmission) params.append("trans", transmission);

  // Price and certification flags
  params.append("hprc", "True");
  params.append("wcp", "True");

  // Condition
  params.append("sts", "New-Used");

  // Market type
  params.append("inMarket", "advancedSearch");

  // Keyword (if exists)
  if (keywords) params.append("kwd", keywords);

  return `${siteConfig.baseUrl}${path}?${params.toString()}`;
};

module.exports = { buildUrl };
