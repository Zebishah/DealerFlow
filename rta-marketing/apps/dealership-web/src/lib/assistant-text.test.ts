import { describe, expect, it } from "vitest";
import { formatAssistantAnswer } from "@rta/assistant-ui";

describe("formatAssistantAnswer", () => {
  it("removes Markdown decoration and keeps readable structure", () => {
    const answer = "## Summary\n\n**Inventory is healthy.**\n- Check the `source status`\n- [Open inventory](/inventory)";

    expect(formatAssistantAnswer(answer)).toBe("Summary\n\nInventory is healthy.\n• Check the source status\n• Open inventory");
  });

  it("unwraps structured answer JSON before cleaning its text", () => {
    const answer = JSON.stringify({ answer: "**Three** approved sources are active." });

    expect(formatAssistantAnswer(answer)).toBe("Three approved sources are active.");
  });

  it("preserves ordinary asterisks that are not Markdown emphasis", () => {
    expect(formatAssistantAnswer("Use 5 * 2 to calculate the total.")).toBe("Use 5 * 2 to calculate the total.");
  });
});
