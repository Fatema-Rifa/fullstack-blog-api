const express = require("express");
const router = express.Router();

const categoryTagController = require("../controllers/categoryTagController");

router.get("/", categoryTagController.getTags);
router.get("/:slug", categoryTagController.getTagBySlug);

module.exports = router;
