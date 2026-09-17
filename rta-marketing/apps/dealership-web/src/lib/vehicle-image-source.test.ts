import { describe, expect, it } from "vitest";
import { isRomansImageUrl } from "./vehicle-image-source";

describe("isRomansImageUrl", () => {
  it.each([
    "https://images.67degrees.co.uk/vehicle.jpg",
    "https://images.67degreescdn.co.uk/vehicle.jpg",
    "https://www.romansinternational.com/images/vehicle.jpg",
  ])("recognizes approved Romans image host %s", (url) => {
    expect(isRomansImageUrl(url)).toBe(true);
  });

  it("does not allow lookalike hosts or insecure protocols", () => {
    expect(isRomansImageUrl("https://images.67degreescdn.co.uk.attacker.com/vehicle.jpg")).toBe(false);
    expect(isRomansImageUrl("http://images.67degreescdn.co.uk/vehicle.jpg")).toBe(false);
  });
});
