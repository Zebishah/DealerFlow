const { baseUrl } = require("../../config/sites/cargurus");
const { makesData } = require("../../data/makesData");

/**
 * Builds CarGurus search URL (minimal, homepage-style)
 * Example:
 * https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?sourceContext=carGurusHomePageModel&entitySelectingHelper.selectedEntity=d2278&zip=10023
 */
function buildUrl(filters = {}) {
  const { make = "", model = "", zipCode = "10001" } = filters;

  const params = new URLSearchParams();
  params.set("sourceContext", "carGurusHomePageModel");

  let entityCode = null;

  // Find the model in makesData
  if (model) {
    const makeObj = makesData.makes.find((m) => m.name === make);
    if (makeObj) {
      const modelObj = makeObj.models.find((mod) => mod.name === model);
      if (modelObj?.code) {
        // Extract part after slash (e.g., m4/d2278 → d2278)
        const parts = modelObj.code.split("/");
        entityCode = parts[1] || parts[0];
      }
    }
  }

  // Fallback: if no model found, try make code
  if (!entityCode && make) {
    const makeObj = makesData.makes.find((m) => m.name === make);
    if (makeObj?.code) {
      const parts = makeObj.code.split("/");
      entityCode = parts[1] || parts[0];
    }
  }

  // Add entitySelectingHelper param
  if (entityCode) {
    params.set("entitySelectingHelper.selectedEntity", entityCode);
  }
  console.log("entityCode:", entityCode);
  // Always include ZIP
  params.set("zip", zipCode);

  return `${baseUrl}?${params.toString()}`;
}

module.exports = { buildUrl };
