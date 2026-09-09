// Compatibility logger for the legacy source parsers. The renovated API uses Pino.
// Never persist browser state, page HTML, secrets, or stack traces here.
function sanitize(value) {
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key, item]) => item !== undefined && !/secret|token|password|cookie/i.test(key))
      .map(([key, item]) => [key, item instanceof Error ? item.message : item]),
  );
}

async function logAsync(level, message, data = {}) {
  const entry = JSON.stringify({ level, message, data: sanitize(data), time: new Date().toISOString() });
  if (level === "error") console.error(entry);
  else if (level === "warn") console.warn(entry);
  else console.log(entry);
}

module.exports = { logAsync };
