import { describe, expect, it } from "vitest";
import { resolveApiBase } from "./api-base";

describe("API origin selection", () => {
  it("keeps Vercel production authentication on the website origin even with the existing Render setting", () => {
    expect(resolveApiBase({ production: true, hostname: "rta-dealership-web.vercel.app", apiUrl: "https://rta-dealership-api.onrender.com/api/v1" })).toBe("/rta-api");
    expect(resolveApiBase({ production: true, hostname: "rta-preview-123.vercel.app" })).toBe("/rta-api");
  });

  it("supports the first-party gateway on a custom production domain", () => {
    expect(resolveApiBase({ production: true, hostname: "rta.example", sameOrigin: true })).toBe("/rta-api");
  });

  it("preserves direct API configuration for development and other hosting setups", () => {
    expect(resolveApiBase({ production: false, hostname: "localhost" })).toBe("http://localhost:5000/api/v1");
    expect(resolveApiBase({ production: false, hostname: "localhost", apiUrl: " https://api.example/api/v1/// " })).toBe("https://api.example/api/v1");
    expect(resolveApiBase({ production: true, hostname: "rta.example", apiUrl: "/api/v1/" })).toBe("/api/v1");
  });
});
