const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const tagSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Tag name is required"],
      unique: true,
      trim: true,
      lowercase: true,
      maxlength: [30, "Tag name cannot exceed 30 characters"],
    },
    slug: { type: String, unique: true },
    postsCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tagSchema.pre("save", function (next) {
  if (this.isModified("name") || !this.slug) {
    this.slug = slugify(this.name);
  }
  next();
});

module.exports = mongoose.model("Tag", tagSchema);
