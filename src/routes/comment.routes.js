const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const commentController = require("../controllers/commentController");
const { protect } = require("../middleware/auth");
const validate = require("../middleware/validate");

const commentValidator = [
  body("content").trim().isLength({ min: 1, max: 1000 }).withMessage("Comment must be 1-1000 characters"),
];

// Standalone comment routes (not nested under posts)
router.get("/:commentId/replies", commentController.getReplies);
router.put("/:id", protect, commentValidator, validate, commentController.updateComment);
router.delete("/:id", protect, commentController.deleteComment);
router.post("/:id/like", protect, commentController.toggleCommentLike);

module.exports = router;
