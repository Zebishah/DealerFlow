const request = require("supertest");
const express = require("express");
const { fork } = require("child_process");
const firestoreService = require("../services/firestoreService");

jest.mock("child_process");
jest.mock("../services/firestoreService");
require("dotenv").config();

const app = express();
app.use(express.json());
require("../index");
console.log("process.env", process.env.API_SECRET_TOKEN);
describe("API Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.API_SECRET_TOKEN = "test-token";
  });

  test("POST /trigger-ftp-download triggers job with valid token", async () => {
    firestoreService.createDownloadLog.mockResolvedValue("trigger-id");
    fork.mockReturnValue({ on: jest.fn() });

    const response = await request(app)
      .post("/trigger-ftp-download")
      .send({ token: "test-token" });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      message: "FTP download triggered",
      triggerId: "trigger-id",
    });
    expect(firestoreService.createDownloadLog).toHaveBeenCalled();
    expect(fork).toHaveBeenCalledWith("jobs/ftpDownloadJob.js");
  });

  test("POST /trigger-ftp-download fails with invalid token", async () => {
    const response = await request(app)
      .post("/trigger-ftp-download")
      .send({ token: "wrong-token" });

    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: "Invalid token" });
  });

  //   test('GET /download-logs fetches logs', async () => {
  //     firestoreService.db = {
  //       collection: () => ({
  //         orderBy: () => ({
  //           get: jest.fn().mockResolvedValue({
  //             docs: [
  //               { id: 'log1', data: () => ({ fileName: 'test.csv', syncStatus: 'PENDING' }) },
  //             ],
  //           }),
  //         }),
  //       }),
  //     };

  //     const response = await request(app).get('/download-logs');
  //     expect(response.status).toBe(200);
  //     expect(response.body).toEqual([{ id: 'log1', fileName: 'test.csv', syncStatus: 'PENDING' }]);
  //   });
});
