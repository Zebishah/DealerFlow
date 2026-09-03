const parserService = require("../services/parserService");
jest.mock("axios");

describe("Parser Service", () => {
  test("parseCSV parses CSV buffer correctly", async () => {
    const csvBuffer = Buffer.from("id,name\n1,Test");
    const result = await parserService.parseCSV(csvBuffer);
    expect(result.records).toEqual([{ id: "1", name: "Test" }]);
    expect(result.successCount).toBe(1);
    expect(result.errors).toEqual([]);
  });
});
