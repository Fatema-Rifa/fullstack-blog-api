const mongoose = require("mongoose");
const dns = require("dns");

let isConnecting = false;

/**
 * Connect to MongoDB with caching for serverless environments (Vercel)
 */
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) {
    return mongoose.connection;
  }

  if (!process.env.MONGO_URI) {
    throw new Error(
      "MONGO_URI is missing from environment variables. Please add MONGO_URI in your Vercel Project Settings."
    );
  }

  if (isConnecting) {
    while (isConnecting) {
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    return mongoose.connection;
  }

  isConnecting = true;
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    // If ISP DNS refused the SRV lookup, fallback to standard public DNS and retry once
    if (error.message && error.message.includes("querySrv")) {
      try {
        console.warn("⚠️ DNS SRV lookup failed on default resolver, retrying with Google/Cloudflare DNS...");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const conn = await mongoose.connect(process.env.MONGO_URI, {
          serverSelectionTimeoutMS: 5000,
        });
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
      } catch (retryError) {
        console.error(`❌ MongoDB connection error on retry: ${retryError.message}`);
        throw retryError;
      }
    }
    console.error(`❌ MongoDB connection error: ${error.message}`);
    throw error;
  } finally {
    isConnecting = false;
  }
};

module.exports = connectDB;
