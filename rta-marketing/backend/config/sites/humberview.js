// config/sites/humberview.js
module.exports = {
  name: "HumberviewVW.com",
  baseUrl: "https://www.humberviewvw.com",
  urlTemplate: "/en/group-all-inventory/{make}/{model}",
  queryParams: "?year={year}&maxPrice={maxPrice}",
  selectors: {
    item: ".inventory-item",
    title: ".vehicle-title",
    price: ".price",
    year: ".year",
    mileage: ".mileage",
    link: "a",
  },
  pagination: null,
};
