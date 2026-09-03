// config/sites/autotrader.js
module.exports = {
  name: "AutoPlanet.ca",
  baseUrl: "https://www.autoplanet.ca",

  selectors: {
    item: ".result-item",
    title: "h2 a",
    price: ".price",
    year: ".year",
    mileage: ".odometer",
    link: "h2 a",
  },
};
