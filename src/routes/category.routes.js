const express = require("express");
const router = express.Router();
const { body } = require("express-validator");

const categoryTagController = require("../controllers/categoryTagController");
const { protect, authorize } = require("../middleware/auth");
const validate = require("../middleware/validate");

const categoryValidator = [
  body("name").trim().isLength({ min: 1, max: 50 }).withMessage("Category name is required (max 50 chars)"),
  body("color").optional().matches(/^#[0-9A-Fa-f]{6}$/).withMessage("Invalid hex color"),
];

// ── Category Routes ───────────────────────────────────────────────────────────
router.get("/", categoryTagController.getCategories);
router.post("/", protect, authorize("admin"), categoryValidator, validate, categoryTagController.createCategory);
router.put("/:id", protect, authorize("admin"), validate, categoryTagController.updateCategory);
router.delete("/:id", protect, authorize("admin"), categoryTagController.deleteCategory);

module.exports = router;
