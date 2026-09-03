const cron = require("node-cron");
const { fork } = require("child_process");

class InventoryScheduler {
  start() {
    // // Schedule FTP download job at 2:00 AM daily
    cron.schedule("0 2 * * *", () => {
      console.log(`${new Date().toISOString()} - Starting FTP download job`);
      const job = fork("jobs/ftpDownloadJob.js");
      job.on("exit", (code) => {
        console.log(
          `${new Date().toISOString()} - FTP download job exited with code ${code}`
        );
      });
    });

    console.log(`${new Date().toISOString()} - Scheduler started`);
  }
}

module.exports = new InventoryScheduler();
