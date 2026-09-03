const { storage } = require("../config/firebaseAdmin");
const { validateEnv } = require("../utils/envValidator");
require("dotenv").config();

// Required environment variables
const REQUIRED_ENV = ["FIREBASE_STORAGE_BUCKET", "STORAGE_PATH"];

class StorageService {
  constructor() {
    validateEnv(REQUIRED_ENV);
    this.bucket = storage.bucket(process.env.FIREBASE_STORAGE_BUCKET);
  }

  // Upload file to Firebase Storage and return download URL
  async uploadFile(buffer, destination, metadata = {}) {
    try {
      const file = this.bucket.file(destination);

      await file.save(buffer, {
        metadata: {
          contentType: "text/csv",
          ...metadata,
        },
        resumable: false,
      });

      // Make file publicly accessible (optional — remove if you don’t want this)
      await file.makePublic();

      const downloadUrl = `https://storage.googleapis.com/${process.env.FIREBASE_STORAGE_BUCKET}/${destination}`;

      console.log(
        `${new Date().toISOString()} - Uploaded file to Storage: ${destination}`
      );

      return downloadUrl;
    } catch (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }
  }
}

module.exports = new StorageService();
