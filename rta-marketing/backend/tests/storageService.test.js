const storageService = require("../services/storageService");
jest.mock("firebase-admin", () => ({
  storage: () => ({
    bucket: () => ({
      file: () => ({
        save: jest.fn().mockResolvedValue(),
        getSignedUrl: jest.fn().mockResolvedValue(["https://example.com"]),
      }),
    }),
  }),
}));

describe("Storage Service", () => {
  test("uploadFile uploads and returns storage path and URL", async () => {
    const buffer = Buffer.from("test");
    const result = await storageService.uploadFile(buffer, "test.csv");
    expect(result).toHaveProperty("storagePath", "test.csv");
    expect(result).toHaveProperty("downloadUrl", "https://example.com");
  });
});
