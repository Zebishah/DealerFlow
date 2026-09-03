const ftp = require("basic-ftp");
const { validateEnv } = require("../utils/envValidator");
const { Writable } = require("stream");
require("dotenv").config();

// Required environment variables
const REQUIRED_ENV = [
  "FTP_HOST",
  "FTP_USER",
  "FTP_PASSWORD",
  "FTP_FILE_NAME",
  "FTP_FILE_PATH",
];

class FTPService {
  constructor() {
    validateEnv(REQUIRED_ENV);
    this.client = new ftp.Client();
    this.client.ftp.verbose = true; // Set to true for debugging
  }

  // Connect to FTP server
  async connectToFTP() {
    try {
      await this.client.access({
        host: process.env.FTP_HOST,
        user: process.env.FTP_USER,
        password: process.env.FTP_PASSWORD,
        secure: false, // Adjust for FTPS if needed
        passive: true, // Enable passive mode
      });
      console.log(`${new Date().toISOString()} - Connected to FTP server`);
    } catch (error) {
      throw new Error(`FTP connection failed: ${error.message}`);
    }
  }

  async downloadFile(fileName) {
    try {
      const remotePath = `${process.env.FTP_FILE_PATH}${fileName}`;

      // Collect file bytes in memory
      const chunks = [];
      const writable = new Writable({
        write(chunk, encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      // Download the file into the writable stream
      await this.client.downloadTo(writable, remotePath);

      // Combine chunks into one buffer
      const buffer = Buffer.concat(chunks);

      // Retrieve file metadata (size + modified date)
      let metadata = {};
      try {
        const dir = await this.client.list(process.env.FTP_FILE_PATH);
        const entry = dir.find((e) => e.name === fileName);
        if (entry) {
          metadata = {
            size: entry.size,
            lastModified: entry.modifiedAt || entry.rawModifiedAt || new Date(), // fallback to now if unavailable
          };
        } else {
          // fallback: use size() if entry not found
          const size = await this.client.size(remotePath);
          metadata = { size, lastModified: new Date() };
        }
      } catch (err) {
        metadata = { size: buffer.length, lastModified: new Date() };
      }

      console.log(`${new Date().toISOString()} - Downloaded file: ${fileName}`);
      return { buffer, metadata };
    } catch (error) {
      throw new Error(`FTP download failed: ${error.message}`);
    }
  }

  // Get file metadata (last modified date)
  async getFileMetadata(fileName) {
    try {
      const response = await this.client.lastMod(fileName);
      return { lastModified: response };
    } catch (error) {
      throw new Error(`FTP metadata fetch failed: ${error.message}`);
    }
  }

  // Disconnect from FTP server
  async disconnect() {
    try {
      await this.client.close();
      console.log(`${new Date().toISOString()} - Disconnected from FTP server`);
    } catch (error) {
      console.error(
        `${new Date().toISOString()} - FTP disconnect failed: ${error.message}`
      );
    }
  }
}

module.exports = new FTPService();
