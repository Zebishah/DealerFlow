// Validate required environment variables
require("dotenv").config();

const validateEnv = (requiredVars) => {
  const missing = requiredVars.filter((varName) => !process.env[varName]);
  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(", ")}`
    );
  }
};

module.exports = { validateEnv };
