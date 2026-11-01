const app = require("../src/app");
const connectDB = require("../src/config/db");

// Serverless function handler for Vercel
module.exports = async (req, res) => {
  try {
    await connectDB();
  } catch (error) {
    console.error("Database connection failed in serverless function:", error);
    return res.status(500).json({
      success: false,
      message: "Database connection failed",
      error: error.message,
    });
  }

  return app(req, res);
};
