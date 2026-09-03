const express = require("express");
const bodyParser = require("body-parser");
const { admin, db, auth } = require("./config/firebaseAdmin");
const cors = require("cors");
const swaggerJSDoc = require("swagger-jsdoc");
const swaggerUi = require("swagger-ui-express");
const swaggerOptions = require("./config/SwaggerOptions");
const inventoryScheduler = require("./schedulers/inventoryScheduler");
const scrapeRoutes = require("./routes/scrape.routes");
const { fork } = require("child_process");

require("dotenv").config();

// admin.initializeApp({
//   credential: admin.credential.cert({
//     type: process.env.type,
//     project_id: process.env.project_id,
//     private_key_id: process.env.private_key_id,
//     private_key: process.env.private_key.replace(/\\n/g, "\n"),
//     client_email: process.env.client_email,
//     client_id: process.env.client_id,
//     auth_uri: process.env.auth_uri,
//     token_uri: process.env.token_uri,
//     auth_provider_x509_cert_url: process.env.auth_provider_x509_cert_url,
//     client_x509_cert_url: process.env.client_x509_cert_url,
//     universe_domain: process.env.universe_domain,
//   }),
// });
// const db = admin.firestore();
// const auth = admin.auth();

const swaggerDocs = swaggerJSDoc(swaggerOptions);
const app = express();
const publicCors = cors(); // allows all origins

app.use(bodyParser.json());
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerDocs));

app.get("/", (req, res) => {
  res.send(`
    <html>
      <head>
        <title>RTA Backend</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            text-align: center;
            padding-top: 50px;
          }
          button {
            padding: 10px 20px;
            font-size: 16px;
            background-color: #003160;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
          }
          button:hover {
            background-color: #0056b3;
          }
        </style>
      </head>
      <body>
        <h2>RTA Backend</h2>
        <p>Please click below to view the API documentation:</p>
        <button onclick="location.href='/api-docs'">Go to API Docs</button>
      </body>
    </html>
  `);
});

/**
 * @swagger
 * tags:
 *   name: Leads
 *   description: Leads management endpoints
 */

/**
 * @swagger
 * /leads:
 *   post:
 *     summary: Create a new lead
 *     tags: [Leads]
 *     security:
 *       - bearerAuth: []
 *     description: |
 *       This endpoint allows you to create a new lead in the system.
 *       All fields are required.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Lead'
 *           examples:
 *             example1:
 *               summary: Basic lead example
 *               value:
 *                 leadAmount: 50000
 *                 leadCost: 500
 *                 leadSource: "Website Form"
 *                 receivedDate: "2023-05-15T10:00:00Z"
 *     responses:
 *       201:
 *         description: Lead created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ApiResponse'
 *             examples:
 *               successResponse:
 *                 value:
 *                   success: true
 *                   message: "Lead created successfully"
 *                   id: "abc123def456"
 *       400:
 *         description: Bad request - missing or invalid parameters
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "All fields are required"
 *       401:
 *         description: Unauthorized - missing or invalid authentication
 *       500:
 *         description: Internal server error
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Error creating lead"
 */
app.post("/leads", publicCors, async (req, res) => {
  const { appid } = req.query; // Get API key from query string

  const expectedKey = process.env.PUBLIC_LEAD_API_KEY;

  if (appid !== expectedKey) {
    return res
      .status(401)
      .json({ error: "Unauthorized: Invalid or Missing API Key" });
  }
  const { leadAmount, leadCost, leadSource, receivedDate } = req.body;

  if (!leadAmount || !leadCost || !leadSource || !receivedDate) {
    return res.status(400).send("All fields are required");
  }

  try {
    const docRef = await db.collection("apiLeads").add({
      leadAmount,
      leadCost,
      leadSource,
      receivedDate,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return res.status(201).json({
      success: true,
      message: "Lead created successfully",
      id: docRef.id,
    });
  } catch (error) {
    console.error("Error creating lead:", error);
    return res.status(500).send("Error creating lead");
  }
});
const allowedOrigins = process.env.CORS_ORIGIN.split(",");

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, Postman)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS: " + origin), false);
      }
    },
  })
);

app.post("/disableUser", async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).send("User ID is required");
  }

  try {
    await admin.auth().updateUser(uid, { disabled: true });
    res.status(200).send(`User ${uid} has been disabled.`);
  } catch (error) {
    console.error("Error disabling user:", error);
    res.status(500).send("Error disabling user");
  }
});

app.post("/enableUser", async (req, res) => {
  const { uid } = req.body;

  if (!uid) {
    return res.status(400).send("User ID is required");
  }

  try {
    await admin.auth().updateUser(uid, { disabled: false });
    res.status(200).send(`User ${uid} has been enabled.`);
  } catch (error) {
    console.error("Error enabling user:", error);
    res.status(500).send("Error enabling user");
  }
});

app.post("/deleteUser", async (req, res) => {
  try {
    const { uid } = req.body;

    const collections = ["employees", "virtual-assistants"];
    let userDocRef = null;
    let userData = null;

    for (const collection of collections) {
      const querySnapshot = await db
        .collection(collection)
        .where("uid", "==", uid)
        .limit(1)
        .get();

      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        userDocRef = doc.ref;
        userData = doc.data();
        break;
      }
    }

    if (!userDocRef || !userData) {
      return res.status(404).json({ error: "User not found in collections" });
    }

    if (!userData.email) {
      return res
        .status(400)
        .json({ error: "Email not found in user document" });
    }

    // ✅ Delete user from Firebase Auth (Admin SDK)
    await auth.deleteUser(uid);

    // ✅ Mark document as deleted
    await userDocRef.update({ isDeleted: true });

    return res.status(200).json({ success: true });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

// Manual trigger endpoint for FTP download
app.post("/trigger-ftp-download", async (req, res) => {
  try {
    const { token } = req.body;
    if (token !== process.env.API_SECRET_TOKEN) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // Fork FTP download job and wait for completion
    const job = fork("jobs/ftpDownloadJob.js", [], {
      env: { ...process.env, TRIGGER_TYPE: "MANUAL" },
    });

    job.on("message", (message) => {
      // Handle messages from the child process
      if (message.status === "success") {
        res.status(200).json({
          status: "success",
          message: "FTP download completed successfully",
          downloadUrl: message.downloadUrl,
        });
      } else if (message.status === "error") {
        res.status(500).json({
          status: "error",
          error: message.error || "FTP download failed",
        });
      }
    });

    job.on("exit", (code) => {
      console.log(
        `${new Date().toISOString()} - Manual FTP download job exited with code ${code}`
      );
      if (!res.headersSent) {
        // Fallback in case the job exits without sending a message
        res.status(500).json({
          status: "error",
          error: `FTP download job exited unexpectedly with code ${code}`,
        });
      }
    });

    job.on("error", (error) => {
      console.error(
        `${new Date().toISOString()} - Manual trigger failed: ${error.message}`
      );
      if (!res.headersSent) {
        res.status(500).json({
          status: "error",
          error: `Failed to trigger FTP download: ${error.message}`,
        });
      }
    });
  } catch (error) {
    console.error(
      `${new Date().toISOString()} - Manual trigger failed: ${error.message}`
    );
    res.status(500).json({
      status: "error",
      error: `Failed to trigger FTP download: ${error.message}`,
    });
  }
});

app.use("/api/scrape", scrapeRoutes);
// Start cron scheduler
inventoryScheduler.start();
const port = process.env.PORT || 5000;
app.listen(port, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${port}`);
});
