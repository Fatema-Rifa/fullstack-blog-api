require("dotenv").config();
const mongoose = require("mongoose");
const connectDB = require("../config/db");
const slugify = require("./slugify");

// Models
const User = require("../models/User");
const Post = require("../models/Post");
const Category = require("../models/Category");
const Comment = require("../models/Comment");
const Tag = require("../models/Tag");
const Like = require("../models/Like");
const Follow = require("../models/Follow");

const initialCategories = [
  { name: "Technology", description: "Tech news, gadgets, innovations, and deep dives.", color: "#3b82f6" },
  { name: "Web Development", description: "Full-stack development, modern frameworks, and best practices.", color: "#10b981" },
  { name: "Design & UI", description: "UI/UX design principles, design systems, and visual inspiration.", color: "#ec4899" },
  { name: "Tutorials & Guides", description: "Step-by-step developer tutorials and coding walkthroughs.", color: "#8b5cf6" },
  { name: "Productivity", description: "Workflows, habits, tools, and developer productivity hacks.", color: "#06b6d4" },
  { name: "Lifestyle & Career", description: "Career growth, work-life balance, and engineering journeys.", color: "#f59e0b" },
];

const initialTags = [
  "javascript",
  "react",
  "nodejs",
  "express",
  "mongodb",
  "webdev",
  "css",
  "tailwind",
  "firebase",
  "api",
  "tutorial",
  "productivity",
];

const initCollections = async () => {
  try {
    console.log("⏳ Connecting to MongoDB Atlas...");
    await connectDB();

    console.log("\n📦 Initializing and creating all MongoDB collections & indexes...");

    const models = [
      { name: "User", model: User, collection: "users" },
      { name: "Post", model: Post, collection: "posts" },
      { name: "Category", model: Category, collection: "categories" },
      { name: "Comment", model: Comment, collection: "comments" },
      { name: "Tag", model: Tag, collection: "tags" },
      { name: "Like", model: Like, collection: "likes" },
      { name: "Follow", model: Follow, collection: "follows" },
    ];

    for (const { name, model, collection } of models) {
      try {
        await model.createCollection();
        await model.createIndexes();
        console.log(`  ✅ Collection '${collection}' (${name}) ready.`);
      } catch (err) {
        console.log(`  ℹ️ Collection '${collection}': ${err.message}`);
      }
    }

    // Seed default starter categories with proper slugs
    console.log("\n🌱 Seeding default starter categories...");
    for (const cat of initialCategories) {
      await Category.findOneAndUpdate(
        { name: cat.name },
        { ...cat, slug: slugify(cat.name) },
        { upsert: true, new: true }
      );
    }
    console.log(`  ✅ Processed ${initialCategories.length} starter categories.`);

    // Seed default starter tags with proper slugs
    console.log("🌱 Seeding default starter tags...");
    for (const tagName of initialTags) {
      await Tag.findOneAndUpdate(
        { name: tagName.toLowerCase().trim() },
        { name: tagName.toLowerCase().trim(), slug: slugify(tagName) },
        { upsert: true, new: true }
      );
    }
    console.log(`  ✅ Processed ${initialTags.length} starter tags.`);

    // List all collections verified in database
    const db = mongoose.connection.db;
    const allCollections = await db.listCollections().toArray();
    console.log("\n========================================================");
    console.log("🎉 Successfully verified all collections in MongoDB Atlas:");
    allCollections.forEach((c, index) => {
      console.log(`  ${index + 1}. ${c.name}`);
    });
    console.log("========================================================\n");

    await mongoose.disconnect();
    console.log("🔌 Disconnected cleanly.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error initializing collections:", error);
    process.exit(1);
  }
};

initCollections();
