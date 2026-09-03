const swaggerOptions = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Leads API",
      // version: "1.0.0",
      description: "API for Posting leads in the RTA marketing",
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Local development server",
      },
      {
        url: "https://your-production-url.com",
        description: "Production server",
      },
    ],
    components: {
      schemas: {
        Lead: {
          type: "object",
          properties: {
            leadAmount: {
              type: "number",
              description: "The monetary amount associated with the lead",
              example: 50000,
            },
            leadCost: {
              type: "number",
              description: "The cost incurred to acquire this lead",
              example: 500,
            },
            leadSource: {
              type: "string",
              description: "The source from which the lead was acquired",
              example: "Website Form",
              enum: [
                "Website Form",
                "Social Media",
                "Referral",
                "Cold Call",
                "Other",
              ],
            },
            receivedDate: {
              type: "string",
              format: "date-time",
              description: "The date when the lead was received",
              example: "2023-05-15T10:00:00Z",
            },
          },
          required: ["leadAmount", "leadCost", "leadSource", "receivedDate"],
          example: {
            leadAmount: 50000,
            leadCost: 500,
            leadSource: "Website Form",
            receivedDate: "2023-05-15T10:00:00Z",
          },
        },
        ApiResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              description: "Indicates if the request was successful",
              example: true,
            },
            message: {
              type: "string",
              description: "A message describing the result",
              example: "Lead created successfully",
            },
            id: {
              type: "string",
              description: "The ID of the created lead",
              example: "abc123def456",
            },
          },
          required: ["success", "message"],
          example: {
            success: true,
            message: "Lead created successfully",
            id: "abc123def456",
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: {
              type: "boolean",
              example: false,
            },
            message: {
              type: "string",
              example: "Error creating lead",
            },
          },
          example: {
            success: false,
            message: "Error creating lead",
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description:
            'JWT Authorization header using the Bearer scheme. Example: "Authorization: Bearer {token}"',
        },
      },
      examples: {
        LeadExample: {
          value: {
            leadAmount: 50000,
            leadCost: 500,
            leadSource: "Website Form",
            receivedDate: "2023-05-15T10:00:00Z",
          },
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ["./index.js"],
};
module.exports = swaggerOptions;
