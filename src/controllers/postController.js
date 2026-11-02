const Post = require("../models/Post");
const Tag = require("../models/Tag");
const Category = require("../models/Category");
const Like = require("../models/Like");
const { sendSuccess, sendError, sendPaginated } = require("../utils/apiResponse");
const { deleteFromCloudinary } = require("../config/cloudinary");
const { isOwnerOrAdmin } = require("../middleware/auth");

const normalizeCoverImage = (value) => {
  if (typeof value === "string") {
    try {
      return normalizeCoverImage(JSON.parse(value));
    } catch {
      return value.trim() ? { url: value.trim(), publicId: "" } : null;
    }
  }

  if (!value || typeof value !== "object" || typeof value.url !== "string" || !value.url.trim()) {
    return null;
  }

  return {
    url: value.url.trim(),
    publicId: typeof value.publicId === "string" ? value.publicId : "",
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: resolve tags by name, create if not exists
// ─────────────────────────────────────────────────────────────────────────────
const resolveTagIds = async (tagNames = []) => {
  if (!tagNames.length) return [];
  const ids = await Promise.all(
    tagNames.map(async (name) => {
      const tag = await Tag.findOneAndUpdate(
        { name: name.toLowerCase().trim() },
        { $setOnInsert: { name: name.toLowerCase().trim() } },
        { upsert: true, new: true }
      );
      return tag._id;
    })
  );
  return ids;
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts  – list, search, filter, paginate
// ─────────────────────────────────────────────────────────────────────────────
exports.getPosts = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      tag,
      author,
      status = "published",
      sortBy = "publishedAt",
      sortOrder = "desc",
      featured,
    } = req.query;

    const query = {};

    // Only admins and the requested author can see non-published posts
    const isRequestedAuthor =
      req.user && author && req.user._id.toString() === author.toString();
    if (req.user?.role === "admin" || isRequestedAuthor) {
      if (status !== "all") query.status = status;
    } else {
      query.status = "published";
    }

    // Full-text search
    if (search) {
      query.$text = { $search: search };
    }

    // Filters
    if (category) query.category = category;
    if (author) query.author = author;
    if (featured !== undefined) query.isFeatured = featured === "true";

    if (tag) {
      const tagDoc = await Tag.findOne({ slug: tag });
      if (tagDoc) query.tags = tagDoc._id;
    }

    const sort = {};
    if (search) {
      sort.score = { $meta: "textScore" };
    }
    sort[sortBy] = sortOrder === "asc" ? 1 : -1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Post.countDocuments(query);

    const posts = await Post.find(query)
      .sort(sort)
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "username name avatar")
      .populate("category", "name slug color")
      .populate("tags", "name slug")
      .lean();

    return sendPaginated(res, posts, page, limit, total, "Posts fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/:slug – single post by slug
// ─────────────────────────────────────────────────────────────────────────────
exports.getPostBySlug = async (req, res, next) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug })
      .populate("author", "username name avatar bio followersCount")
      .populate("category", "name slug color")
      .populate("tags", "name slug");

    if (!post) return sendError(res, "Post not found.", 404);
    if (post.status !== "published" && !isOwnerOrAdmin(post.author._id, req)) {
      return sendError(res, "Post not found.", 404);
    }

    // Increment view count (fire-and-forget)
    Post.findByIdAndUpdate(post._id, { $inc: { viewsCount: 1 } }).exec();

    // Check if current user liked this post
    let isLiked = false;
    if (req.user) {
      isLiked = !!(await Like.findOne({ user: req.user._id, post: post._id }));
    }

    return sendSuccess(res, { post, isLiked }, "Post fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts – create post
// ─────────────────────────────────────────────────────────────────────────────
exports.createPost = async (req, res, next) => {
  try {
    const { title, content, excerpt, category, tags, status } = req.body;

    const tagIds = await resolveTagIds(
      Array.isArray(tags) ? tags : tags ? [tags] : []
    );

    const postData = {
      title,
      content,
      excerpt,
      author: req.user._id,
      status: status || "draft",
    };

    if (category) postData.category = category;
    if (tagIds.length) postData.tags = tagIds;

    if (req.file) {
      const coverImage = normalizeCoverImage({
        url: req.file.path,
        publicId: req.file.filename || req.file.publicId || "",
      });
      if (coverImage) postData.coverImage = coverImage;
    } else {
      const coverImage = normalizeCoverImage(req.body.coverImage);
      if (coverImage) postData.coverImage = coverImage;
    }

    const post = await Post.create(postData);

    // Update tag post counts
    if (tagIds.length) {
      await Tag.updateMany({ _id: { $in: tagIds } }, { $inc: { postsCount: 1 } });
    }
    if (category) {
      await Category.findByIdAndUpdate(category, { $inc: { postsCount: 1 } });
    }

    await post.populate([
      { path: "author", select: "username name avatar" },
      { path: "category", select: "name slug color" },
      { path: "tags", select: "name slug" },
    ]);

    return sendSuccess(res, { post }, "Post created successfully", 201);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/posts/:id – update post
// ─────────────────────────────────────────────────────────────────────────────
exports.updatePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return sendError(res, "Post not found.", 404);

    if (!isOwnerOrAdmin(post.author, req)) {
      return sendError(res, "Not authorized to update this post.", 403);
    }

    const { title, content, excerpt, category, tags, status, isFeatured } = req.body;
    const updates = {};

    if (title !== undefined) updates.title = title;
    if (content !== undefined) updates.content = content;
    if (excerpt !== undefined) updates.excerpt = excerpt;
    if (status !== undefined) updates.status = status;
    if (isFeatured !== undefined) updates.isFeatured = isFeatured;

    // Handle category change
    if (category !== undefined && category !== post.category?.toString()) {
      if (post.category) {
        await Category.findByIdAndUpdate(post.category, { $inc: { postsCount: -1 } });
      }
      if (category) {
        await Category.findByIdAndUpdate(category, { $inc: { postsCount: 1 } });
      }
      updates.category = category || null;
    }

    // Handle tags change
    if (tags !== undefined) {
      const newTagIds = await resolveTagIds(
        Array.isArray(tags) ? tags : tags ? [tags] : []
      );
      const oldTagIds = post.tags.map((t) => t.toString());
      // Decrement old tags
      if (oldTagIds.length) {
        await Tag.updateMany({ _id: { $in: oldTagIds } }, { $inc: { postsCount: -1 } });
      }
      // Increment new tags
      if (newTagIds.length) {
        await Tag.updateMany({ _id: { $in: newTagIds } }, { $inc: { postsCount: 1 } });
      }
      updates.tags = newTagIds;
    }

    // Handle cover image update
    if (req.file) {
      if (post.coverImage?.publicId) {
        await deleteFromCloudinary(post.coverImage.publicId);
      }
      const coverImage = normalizeCoverImage({
        url: req.file.path,
        publicId: req.file.filename || req.file.publicId || "",
      });
      if (coverImage) updates.coverImage = coverImage;
    } else {
      const coverImage = normalizeCoverImage(req.body.coverImage);
      if (coverImage) updates.coverImage = coverImage;
    }

    const updated = await Post.findByIdAndUpdate(req.params.id, updates, {
      new: true,
      runValidators: true,
    }).populate([
      { path: "author", select: "username name avatar" },
      { path: "category", select: "name slug color" },
      { path: "tags", select: "name slug" },
    ]);

    return sendSuccess(res, { post: updated }, "Post updated successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/posts/:id – delete post
// ─────────────────────────────────────────────────────────────────────────────
exports.deletePost = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return sendError(res, "Post not found.", 404);

    if (!isOwnerOrAdmin(post.author, req)) {
      return sendError(res, "Not authorized to delete this post.", 403);
    }

    // Cleanup Cloudinary image
    if (post.coverImage?.publicId) {
      await deleteFromCloudinary(post.coverImage.publicId);
    }

    // Update tag counts
    if (post.tags.length) {
      await Tag.updateMany({ _id: { $in: post.tags } }, { $inc: { postsCount: -1 } });
    }
    if (post.category) {
      await Category.findByIdAndUpdate(post.category, { $inc: { postsCount: -1 } });
    }

    await post.deleteOne();

    return sendSuccess(res, {}, "Post deleted successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:id/like – toggle like on a post
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleLike = async (req, res, next) => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) return sendError(res, "Post not found.", 404);

    const existing = await Like.findOne({ user: req.user._id, post: post._id });
    if (existing) {
      await existing.deleteOne();
      await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: -1 } });
      return sendSuccess(res, { liked: false, likesCount: post.likesCount - 1 }, "Post unliked");
    }

    await Like.create({ user: req.user._id, post: post._id, targetType: "post" });
    await Post.findByIdAndUpdate(post._id, { $inc: { likesCount: 1 } });

    return sendSuccess(res, { liked: true, likesCount: post.likesCount + 1 }, "Post liked");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/by-author/:userId – get posts by a specific user
// ─────────────────────────────────────────────────────────────────────────────
exports.getPostsByAuthor = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const query = { author: req.params.userId };

    // Non-owner can only see published posts
    const isOwner = req.user && req.user._id.toString() === req.params.userId;
    const isAdmin = req.user?.role === "admin";

    if (!isOwner && !isAdmin) {
      query.status = "published";
    } else if (status && status !== "all") {
      query.status = status;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Post.countDocuments(query);
    const posts = await Post.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("category", "name slug color")
      .populate("tags", "name slug")
      .lean();

    return sendPaginated(res, posts, page, limit, total, "Author posts fetched");
  } catch (error) {
    next(error);
  }
};
