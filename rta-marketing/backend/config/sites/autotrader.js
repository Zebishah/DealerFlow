// config/sites/autotrader.js
module.exports = {
  name: "AutoTrader.ca",
  baseUrl: "https://www.autotrader.ca",

  // Map postal prefix → { province, city, provinceName }
  getSlugs: (postal) => {
    const map = {
      A1A: {
        province: "nl",
        city: "st.%20john%27s",
        provinceName: "Newfoundland and Labrador",
      },
      M5V: { province: "on", city: "toronto", provinceName: "Ontario" },
      V6B: {
        province: "bc",
        city: "vancouver",
        provinceName: "British Columbia",
      },
      H3B: { province: "qc", city: "montreal", provinceName: "Quebec" },
      T5J: { province: "ab", city: "edmonton", provinceName: "Alberta" },
      R3C: { province: "mb", city: "winnipeg", provinceName: "Manitoba" },
      S7K: { province: "sk", city: "saskatoon", provinceName: "Saskatchewan" },
      B3J: { province: "ns", city: "halifax", provinceName: "Nova Scotia" },
      C1A: {
        province: "pe",
        city: "charlottetown",
        provinceName: "Prince Edward Island",
      },
      E1C: { province: "nb", city: "moncton", provinceName: "New Brunswick" },
    };

    const key = (postal || "A1A1A1").slice(0, 3).toUpperCase();
    return (
      map[key] || {
        province: "nl",
        city: "st.%20john%27s",
        provinceName: "Newfoundland and Labrador",
      }
    );
  },

  selectors: {
    item: ".result-item",
    title: "h2 a",
    price: ".price",
    year: ".year",
    mileage: ".odometer",
    link: "h2 a",
  },
};
