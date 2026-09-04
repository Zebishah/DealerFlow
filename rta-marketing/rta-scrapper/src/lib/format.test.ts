import { describe, expect, it } from "vitest";
import { formatMoney, formatRelativeTime } from "./format";

describe("formatMoney", () => {
  it("formats Canadian dollar cents", () => expect(formatMoney(3_250_000)).toContain("32,500"));
  it("handles an unavailable price", () => expect(formatMoney(null)).toBe("Price unavailable"));
});

describe("formatRelativeTime", () => {
  const now = Date.parse("2026-09-04T12:00:00Z");
  it("formats recent minutes", () => expect(formatRelativeTime("2026-09-04T11:48:00Z", now)).toBe("12m ago"));
  it("formats hours", () => expect(formatRelativeTime("2026-09-04T09:00:00Z", now)).toBe("3h ago"));
  it("handles missing timestamps", () => expect(formatRelativeTime(null, now)).toBe("No run yet"));
});
