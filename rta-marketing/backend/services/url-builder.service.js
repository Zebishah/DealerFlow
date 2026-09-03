// services/url-builder.service.js
const autotraderBuilder = require("./url-builders/autotrader.builder");
const humberviewBuilder = require("./url-builders/humberview.builder");
const autoPlanetBuilder = require("./url-builders/autoPlanet.builder");
const yorkdalevwBuilder = require("./url-builders/yorkdalevw.builder");
const buildUrls = (filters) => ({
  autotrader: autotraderBuilder.buildUrl(filters),
  autoplanet: autoPlanetBuilder.buildUrl(filters),
  humberview: humberviewBuilder.buildUrl(filters),
  yorkdalevw: yorkdalevwBuilder.buildUrl(filters),
});
module.exports = { buildUrls };
