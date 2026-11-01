const express = require("express");
const router = express.Router();
const { body, query } = require("express-validator");

const postController = require("../controllers/postController");
const commentController = require("../controllers/commentController");
const { protect, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadPostImage } = require("../config/cloudinary");

// Validators
const createPostValidator = [
  body("title").trim().isLength({ min: 5, max: 150 }).withMessage("Title must be 5-150 characters"),
  body("content").isLength({ min: 50 }).withMessage("Content must be at least 50 characters"),
  body("status").optional().isIn(["draft", "published"]).withMessage("Invalid status"),
  body("tags").optional(),
];

const updatePostValidator = [
  body("title").optional().trim().isLength({ min: 5, max: 150 }),
  body("content").optional().isLength({ min: 50 }),
  body("status").optional().isIn(["draft", "published", "archived"]),
];

const commentValidator = [
  body("content")
    .trim()
    .isLength({ min: 1, max: 1000 })
    .withMessage("Comment must be 1-1000 characters"),
];

// ── Post Routes ───────────────────────────────────────────────────────────────

// GET /api/posts  – public list with optional auth for extra data
router.get("/", optionalAuth, postController.getPosts);

// GET /api/posts/by-author/:userId
router.get("/by-author/:userId", optionalAuth, postController.getPostsByAuthor);

// GET /api/posts/:slug  – single post by slug
router.get("/:slug", optionalAuth, postController.getPostBySlug);

// POST /api/posts  – create post (auth required)
router.post(
  "/",
  protect,
  uploadPostImage.single("coverImage"),
  createPostValidator,
  validate,
  postController.createPost
);

// PUT /api/posts/:id  – update post
router.put(
  "/:id",
  protect,
  uploadPostImage.single("coverImage"),
  updatePostValidator,
  validate,
  postController.updatePost
);

// DELETE /api/posts/:id
router.delete("/:id", protect, postController.deletePost);

// POST /api/posts/:id/like – toggle like
router.post("/:id/like", protect, postController.toggleLike);

// ── Comment Routes (nested under post) ───────────────────────────────────────

router.get("/:postId/comments", commentController.getComments);
router.post("/:postId/comments", protect, commentValidator, validate, commentController.createComment);

module.exports = router;
