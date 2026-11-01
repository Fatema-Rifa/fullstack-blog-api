const Category = require("../models/Category");
const Tag = require("../models/Tag");
const { sendSuccess, sendError } = require("../utils/apiResponse");

// ── Categories ────────────────────────────────────────────────────────────────

exports.getCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    return sendSuccess(res, { categories }, "Categories fetched");
  } catch (error) {
    next(error);
  }
};

exports.createCategory = async (req, res, next) => {
  try {
    const { name, description, color } = req.body;
    const category = await Category.create({ name, description, color });
    return sendSuccess(res, { category }, "Category created", 201);
  } catch (error) {
    next(error);
  }
};

exports.updateCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!category) return sendError(res, "Category not found.", 404);
    return sendSuccess(res, { category }, "Category updated");
  } catch (error) {
    next(error);
  }
};

exports.deleteCategory = async (req, res, next) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);
    if (!category) return sendError(res, "Category not found.", 404);
    return sendSuccess(res, {}, "Category deleted");
  } catch (error) {
    next(error);
  }
};

// ── Tags ──────────────────────────────────────────────────────────────────────

exports.getTags = async (req, res, next) => {
  try {
    const { popular } = req.query;
    const sort = popular === "true" ? { postsCount: -1 } : { name: 1 };
    const tags = await Tag.find().sort(sort).limit(100);
    return sendSuccess(res, { tags }, "Tags fetched");
  } catch (error) {
    next(error);
  }
};

exports.getTagBySlug = async (req, res, next) => {
  try {
    const tag = await Tag.findOne({ slug: req.params.slug });
    if (!tag) return sendError(res, "Tag not found.", 404);
    return sendSuccess(res, { tag }, "Tag fetched");
  } catch (error) {
    next(error);
  }
};
