const ftpService = require("../services/ftpService");
jest.mock("basic-ftp");

describe("FTP Service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("downloadFile returns buffer and metadata", async () => {
    const mockBuffer = Buffer.from("test");
    const mockMetadata = { lastModified: new Date() };
    ftpService.client.downloadToBuffer = jest
      .fn()
      .mockResolvedValue(mockBuffer);
    ftpService.client.lastMod = jest
      .fn()
      .mockResolvedValue(mockMetadata.lastModified);

    const result = await ftpService.downloadFile("test.csv");
    expect(result).toEqual({ buffer: mockBuffer, metadata: mockMetadata });
    expect(ftpService.client.downloadToBuffer).toHaveBeenCalled();
  });
});
