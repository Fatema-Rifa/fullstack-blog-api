const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },
    slug: { type: String, unique: true },
    description: {
      type: String,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    color: { type: String, default: "#6366f1" }, // hex color for UI
    postsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

categorySchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model("Category", categorySchema);
