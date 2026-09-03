const { db } = require("../config/firebaseAdmin");
const { validateEnv } = require("../utils/envValidator");

const REQUIRED_ENV = [];

class FirestoreService {
  constructor() {
    validateEnv(REQUIRED_ENV);
  }

  // Create or update download log (upsert)
  async createDownloadLog(data, merge = false) {
    try {
      const logRef = db.collection("ftp_download_logs").doc("latest_inventory");
      await logRef.set(data, { merge });
      console.log(
        `${new Date().toISOString()} - Created/updated Firestore log: latest_inventory`
      );
      return "latest_inventory";
    } catch (error) {
      throw new Error(`Firestore log creation failed: ${error.message}`);
    }
  }
}

module.exports = new FirestoreService();
