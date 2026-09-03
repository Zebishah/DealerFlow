// utils/logger.js

const { logsRef, admin } = require("../config/firebaseAdmin");

// Helper: Remove undefined + convert Error → plain object
const sanitize = (obj) => {
  return JSON.parse(
    JSON.stringify(obj, (key, value) => (value === undefined ? null : value))
  );
};

const logAsync = async (level, message, data = {}) => {
  // Convert Error objects to plain objects and strip undefined
  const safeData =
    data instanceof Error
      ? {
          error: data.message,
          name: data.name,
          stack: data.stack?.split("\n").slice(0, 10).join("\n"),
        }
      : sanitize(data);

  logsRef
    .add({
      level,
      message,
      data: safeData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    })
    .catch((err) => {
      // Optional: fallback to console if Firestore is down
      console.error("[Logger] Firestore write failed:", err.message);
    });
};

module.exports = { logAsync };
