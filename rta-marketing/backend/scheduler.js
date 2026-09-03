require("dotenv").config();
const inventoryScheduler = require("./schedulers/inventoryScheduler");

// Start the scheduler
inventoryScheduler.start();
