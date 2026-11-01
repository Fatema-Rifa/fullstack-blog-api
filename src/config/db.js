const mongoose = require("mongoose");
const dns = require("dns");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    // If Windows / ISP DNS refused the SRV lookup, fallback to standard public DNS and retry once
    if (error.message && error.message.includes("querySrv")) {
      try {
        console.warn("⚠️ DNS SRV lookup failed on default resolver, retrying with Google/Cloudflare DNS...");
        dns.setServers(["8.8.8.8", "1.1.1.1"]);
        const conn = await mongoose.connect(process.env.MONGO_URI);
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return;
      } catch (retryError) {
        console.error(`❌ MongoDB connection error on retry: ${retryError.message}`);
        process.exit(1);
      }
    }
    console.error(`❌ MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
