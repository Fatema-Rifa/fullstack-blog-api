const app = require("../src/app");
const connectDB = require("../src/config/db");

// Serverless function handler for Vercel
module.exports = async (req, res) => {
  // Always attach CORS headers early for Vercel serverless functions
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With");
  }

  // Answer preflight immediately without touching the database
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    return res.end();
  }

  try {
    await connectDB();
  } catch (error) {
    console.error("Database connection failed in serverless function:", error);
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        success: false,
        message:
          "Database connection failed. Please ensure MONGO_URI is set in Vercel Project Settings and MongoDB Atlas Network Access allows 0.0.0.0/0.",
        error: error.message,
      })
    );
  }

  return app(req, res);
};
