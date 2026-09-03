// services/url-builders/yorkdale.builder.js
const siteConfig = require("../../config/sites/yokdalew");

const { exteriorColorId } = require("../../data/exteriorColorId");
const { frameStyleId } = require("../../data/frameStyleId");
const { models, makes } = require("../../data/makeModelIds");
const { transmissionId } = require("../../data/transmissionId");

// Helper function to find facetId by label in make/model arrays
const findFacetIdByLabel = (array, label) => {
  if (!label) return null;
  const item = array.find(
    (item) => item.label.toLowerCase() === label.toLowerCase()
  );
  return item ? item.facetId : null;
};

// Helper function to find filterSlug by label in models array
const findFilterSlugByLabel = (label) => {
  if (!label) return null;
  const item = models.find(
    (item) => item.label.toLowerCase() === label.toLowerCase()
  );
  return item?.data?.filterSlug || null;
};

// Helper function to find key by label in other arrays
const findKeyByLabel = (array, label) => {
  if (!label) return null;
  const item = array.find(
    (item) => item.label.toLowerCase() === label.toLowerCase()
  );
  return item ? item.key : null;
};

/**
 * Build Yorkdale VW inventory URL from filters.
 * Supports: make, model, year, price range, mileage range, transmission, exterior color, body style, keyword
 */
const buildUrl = (filters) => {
  const {
    make,
    model,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    keywords = "",
    minMileage,
    maxMileage,
    transmission,
    exteriorColor,
    bodyStyle,
  } = filters;

  // Count ALL filters including make/model
  const filterCount = [
    make,
    model,
    minYear,
    maxYear,
    minPrice,
    maxPrice,
    minMileage,
    maxMileage,
    transmission,
    exteriorColor,
    bodyStyle,
    keywords,
  ].filter((val) => val != null && val !== "").length;
  if (make) {
    const makeExists = makes.some(
      (item) => item.label.toLowerCase() === make.toLowerCase()
    );
    if (!makeExists) {
      console.warn(
        `Make "${make}" not found in makes array. Cannot build URL.`
      );
      return null;
    }
  }

  // Validate model exists in models array if provided
  if (model) {
    const modelExists = models.some(
      (item) => item.label.toLowerCase() === model.toLowerCase()
    );
    if (!modelExists) {
      console.warn(
        `Model "${model}" not found in models array. Cannot build URL.`
      );
      return null;
    }
  }
  // Check if color filter is present
  const hasColorFilter = exteriorColor != null && exteriorColor !== "";

  // Determine if we should use slug-based URL or query params
  // Use slug if: (make or model present) AND (filterCount <= 2 without color)
  const shouldUseSlug = (make || model) && filterCount <= 2 && !hasColorFilter;

  // --- Build URL ---
  let path = "/inventory/used/";
  const params = new URLSearchParams();

  if (shouldUseSlug) {
    // Slug-based URL: /inventory/used/volkswagen-atlas-cross-sport-toronto-ontario-m55mo995vlp
    if (make) {
      path += `/${encodeURIComponent(make.toLowerCase())}`;
    }
    if (model) {
      path += `${encodeURIComponent(model.toLowerCase().replace(/\s+/g, "-"))}`;
    }

    // Add the dynamic location slug based on model or make
    let locationSlug = "toronto-ontario-m55vlp"; // Default for make-only

    if (model) {
      // Get model-specific filterSlug
      const modelFilterSlug = findFilterSlugByLabel(model);
      if (modelFilterSlug) {
        locationSlug = modelFilterSlug;
      }
    }

    path += `-${locationSlug}`;

    // Add query params for the filters

    // Year range (minYear/maxYear)
    if (minYear != null) {
      params.append("yearRange[gte]", minYear.toString());
    }
    if (maxYear != null) {
      params.append("yearRange[lte]", maxYear.toString());
    }

    if (minPrice != null) {
      params.append("paymentRange[gte]", minPrice.toString());
    }
    if (maxPrice != null) {
      params.append("paymentRange[lte]", maxPrice.toString());
    }

    if (minMileage != null) {
      params.append("mileage[gte]", minMileage.toString());
    }
    if (maxMileage != null) {
      params.append("mileage[lte]", maxMileage.toString());
    }

    if (bodyStyle) {
      params.append("vehicleBodyType[]", bodyStyle.toUpperCase());
    }

    if (transmission) {
      const transmissionKey = findKeyByLabel(transmissionId, transmission);
      if (transmissionKey && transmissionKey !== -1) {
        params.append("transmissionId", transmissionKey.toString());
      }
    }
    if (keywords) {
      params.append("keyword", keywords.toLowerCase());
      params.append("sort[id]", "relevance");
      params.append("sort[sortDirection]", "DESCENDING");
    }

    // Add payment option if price range is specified
    if (minPrice != null || maxPrice != null) {
      params.append("paymentOption", "CASH");
    }
  } else {
    // Query param-based URL with IDs

    // Get make and model facetIds
    if (make) {
      const makeFacetId = findFacetIdByLabel(makes, make);
      if (makeFacetId) {
        params.append("makeId[]", makeFacetId);
      }
    }

    if (model) {
      const modelFacetId = findFacetIdByLabel(models, model);
      if (modelFacetId) {
        params.append("modelId[]", modelFacetId);
      }
    }

    // Year range

    // Year range (minYear/maxYear)
    if (minYear != null) {
      params.append("yearRange[gte]", minYear.toString());
    }
    if (maxYear != null) {
      params.append("yearRange[lte]", maxYear.toString());
    }

    // Body style
    if (bodyStyle) {
      params.append("vehicleBodyType[]", bodyStyle.toUpperCase());
    }

    // Exterior color
    if (exteriorColor) {
      params.append("color[]", exteriorColor.toUpperCase());
    }

    // Price range
    if (minPrice != null) {
      params.append("paymentRange[gte]", minPrice.toString());
    }
    if (maxPrice != null) {
      params.append("paymentRange[lte]", maxPrice.toString());
    }

    // Mileage range
    if (minMileage != null) {
      params.append("mileage[gte]", minMileage.toString());
    }
    if (maxMileage != null) {
      params.append("mileage[lte]", maxMileage.toString());
    }

    // Transmission
    if (transmission) {
      const transmissionKey = findKeyByLabel(transmissionId, transmission);
      if (transmissionKey && transmissionKey !== -1) {
        params.append("transmissionId", transmissionKey.toString());
      }
    }

    // Keyword search
    if (keywords) {
      params.append("keyword", keywords.toLowerCase());
      params.append("sort[id]", "relevance");
      params.append("sort[sortDirection]", "DESCENDING");
    }
    // Add payment option if price range is specified
    if (minPrice != null || maxPrice != null) {
      params.append("paymentOption", "CASH");
    }
  }

  const query = params.toString();
  return `${siteConfig.baseUrl}${path}${query ? `?${query}` : ""}`;
};

module.exports = { buildUrl };
