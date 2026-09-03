// config/sites/autotrader.js
module.exports = {
  name: "CarGurus.com",
  baseUrl:
    "https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action",

  selectors: {
    item: ".result-item",
    title: "h2 a",
    price: ".price",
    year: ".year",
    mileage: ".odometer",
    link: "h2 a",
  },
};
