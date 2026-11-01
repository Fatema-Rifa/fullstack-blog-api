const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const postSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      minlength: [5, "Title must be at least 5 characters"],
      maxlength: [150, "Title cannot exceed 150 characters"],
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: [true, "Content is required"],
      minlength: [50, "Content must be at least 50 characters"],
    },
    excerpt: {
      type: String,
      maxlength: [300, "Excerpt cannot exceed 300 characters"],
    },
    coverImage: {
      url: { type: String, default: "" },
      publicId: { type: String, default: "" },
    },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
    },
    tags: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tag",
      },
    ],
    status: {
      type: String,
      enum: ["draft", "published", "archived"],
      default: "draft",
    },
    publishedAt: { type: Date },
    readTime: { type: Number, default: 0 }, // minutes
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    viewsCount: { type: Number, default: 0 },
    isFeatured: { type: Boolean, default: false },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug from title
postSchema.pre("save", async function (next) {
  if (this.isModified("title") || !this.slug) {
    let base = slugify(this.title);
    let slug = base;
    let count = 1;
    // Ensure slug uniqueness
    while (await mongoose.models.Post.findOne({ slug, _id: { $ne: this._id } })) {
      slug = `${base}-${count++}`;
    }
    this.slug = slug;
  }

  // Auto-generate excerpt from content
  if (!this.excerpt && this.content) {
    this.excerpt = this.content.replace(/(<([^>]+)>)/gi, "").substring(0, 250) + "...";
  }

  // Auto-calculate read time (avg 200 wpm)
  if (this.isModified("content")) {
    const wordCount = this.content.replace(/(<([^>]+)>)/gi, "").split(/\s+/).length;
    this.readTime = Math.ceil(wordCount / 200);
  }

  // Set publishedAt when status changes to published
  if (this.isModified("status") && this.status === "published" && !this.publishedAt) {
    this.publishedAt = new Date();
  }

  next();
});

// Text index for search
postSchema.index({ title: "text", content: "text", excerpt: "text" });
postSchema.index({ author: 1, status: 1 });
postSchema.index({ status: 1, publishedAt: -1 });

module.exports = mongoose.model("Post", postSchema);
