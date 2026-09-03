const firestoreService = require("../services/firestoreService");
jest.mock("../config/firebaseAdmin", () => ({
  db: {
    collection: jest.fn(() => ({
      doc: jest.fn(() => ({
        id: "test-id",
        set: jest.fn().mockResolvedValue(),
        collection: jest.fn(() => ({
          doc: jest.fn(() => ({
            id: "nested-id",
            set: jest.fn().mockResolvedValue(),
          })),
        })),
      })),
      where: jest.fn(() => ({
        get: jest.fn().mockResolvedValue({
          docs: [{ id: "test-id", data: () => ({ syncStatus: "PENDING" }) }],
        }),
      })),
    })),
    batch: jest.fn(() => ({
      set: jest.fn(),
      commit: jest.fn().mockResolvedValue(),
    })),
  },
}));

describe("Firestore Service", () => {
  test("createDownloadLog creates a log entry", async () => {
    const logData = { fileName: "test.csv", syncStatus: "PENDING" };
    const id = await firestoreService.createDownloadLog(logData);
    expect(id).toBe("test-id");
  });

  test("batchWriteRecords handles batch writes", async () => {
    const records = [{ id: 1 }, { id: 2 }];
    await firestoreService.batchWriteRecords(records, "parse-id");
    expect(firestoreService.db.batch).toHaveBeenCalled();
  });
});
