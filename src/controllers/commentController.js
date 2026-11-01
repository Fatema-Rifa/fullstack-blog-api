const Comment = require("../models/Comment");
const Post = require("../models/Post");
const Like = require("../models/Like");
const { sendSuccess, sendError, sendPaginated } = require("../utils/apiResponse");
const { isOwnerOrAdmin } = require("../middleware/auth");

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/posts/:postId/comments – list top-level comments with pagination
// ─────────────────────────────────────────────────────────────────────────────
exports.getComments = async (req, res, next) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const query = { post: req.params.postId, parent: null };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Comment.countDocuments(query);

    const comments = await Comment.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "username name avatar");

    return sendPaginated(res, comments, page, limit, total, "Comments fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/comments/:commentId/replies – get replies of a comment
// ─────────────────────────────────────────────────────────────────────────────
exports.getReplies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const query = { parent: req.params.commentId };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const total = await Comment.countDocuments(query);

    const replies = await Comment.find(query)
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate("author", "username name avatar");

    return sendPaginated(res, replies, page, limit, total, "Replies fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/posts/:postId/comments – create comment (or reply)
// ─────────────────────────────────────────────────────────────────────────────
exports.createComment = async (req, res, next) => {
  try {
    const { content, parentId } = req.body;
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post || post.status !== "published") {
      return sendError(res, "Post not found.", 404);
    }

    let parent = null;
    if (parentId) {
      parent = await Comment.findById(parentId);
      if (!parent) return sendError(res, "Parent comment not found.", 404);
    }

    const comment = await Comment.create({
      content,
      author: req.user._id,
      post: postId,
      parent: parentId || null,
    });

    // Update counts
    await Post.findByIdAndUpdate(postId, { $inc: { commentsCount: 1 } });
    if (parent) {
      await Comment.findByIdAndUpdate(parentId, { $inc: { repliesCount: 1 } });
    }

    await comment.populate("author", "username name avatar");

    return sendSuccess(res, { comment }, "Comment added", 201);
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/comments/:id – update comment
// ─────────────────────────────────────────────────────────────────────────────
exports.updateComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return sendError(res, "Comment not found.", 404);

    if (!isOwnerOrAdmin(comment.author, req)) {
      return sendError(res, "Not authorized to edit this comment.", 403);
    }

    comment.content = req.body.content;
    comment.isEdited = true;
    await comment.save();

    return sendSuccess(res, { comment }, "Comment updated");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /api/comments/:id – delete comment
// ─────────────────────────────────────────────────────────────────────────────
exports.deleteComment = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return sendError(res, "Comment not found.", 404);

    if (!isOwnerOrAdmin(comment.author, req)) {
      return sendError(res, "Not authorized to delete this comment.", 403);
    }

    // Delete all replies
    await Comment.deleteMany({ parent: comment._id });
    await Post.findByIdAndUpdate(comment.post, { $inc: { commentsCount: -1 } });

    if (comment.parent) {
      await Comment.findByIdAndUpdate(comment.parent, { $inc: { repliesCount: -1 } });
    }

    await comment.deleteOne();

    return sendSuccess(res, {}, "Comment deleted");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/comments/:id/like – toggle like on a comment
// ─────────────────────────────────────────────────────────────────────────────
exports.toggleCommentLike = async (req, res, next) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) return sendError(res, "Comment not found.", 404);

    const existing = await Like.findOne({ user: req.user._id, comment: comment._id });
    if (existing) {
      await existing.deleteOne();
      await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: -1 } });
      return sendSuccess(res, { liked: false }, "Comment unliked");
    }

    await Like.create({ user: req.user._id, comment: comment._id, targetType: "comment" });
    await Comment.findByIdAndUpdate(comment._id, { $inc: { likesCount: 1 } });

    return sendSuccess(res, { liked: true }, "Comment liked");
  } catch (error) {
    next(error);
  }
};
