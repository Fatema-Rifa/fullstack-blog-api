const express = require("express");
const router = express.Router();
const { body } = require("express-validator");
const rateLimit = require("express-rate-limit");

const authController = require("../controllers/authController");
const { protect, optionalAuth } = require("../middleware/auth");
const validate = require("../middleware/validate");
const { uploadAvatar } = require("../config/cloudinary");

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { success: false, message: "Too many requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Validators
const registerValidator = [
  body("username")
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage("Username must be 3-30 characters")
    .matches(/^[a-zA-Z0-9_]+$/).withMessage("Username can only contain letters, numbers, underscores"),
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),
  body("name").optional().trim().isLength({ max: 60 }).withMessage("Name cannot exceed 60 characters"),
];

const loginValidator = [
  body("email").isEmail().normalizeEmail().withMessage("Invalid email"),
  body("password").notEmpty().withMessage("Password is required"),
];

const changePasswordValidator = [
  body("currentPassword").notEmpty().withMessage("Current password is required"),
  body("newPassword").isLength({ min: 6 }).withMessage("New password must be at least 6 characters"),
];

// ── Routes ────────────────────────────────────────────────────────────────────

router.post("/register", authLimiter, registerValidator, validate, authController.register);
router.post("/login", authLimiter, loginValidator, validate, authController.login);
router.post("/firebase", authController.firebaseAuth);
router.post("/refresh", authController.refreshToken);
router.post("/logout", protect, authController.logout);

router.get("/me", protect, authController.getMe);
router.put(
  "/update-profile",
  protect,
  uploadAvatar.single("avatar"),
  [
    body("name").optional().trim().isLength({ max: 60 }),
    body("bio").optional().trim().isLength({ max: 300 }),
    body("username").optional().trim().isLength({ min: 3, max: 30 }),
  ],
  validate,
  authController.updateProfile
);
router.put("/change-password", protect, changePasswordValidator, validate, authController.changePassword);

// Public user profile (optionalAuth to determine follow status)
router.get("/users/:username", optionalAuth, authController.getUserProfile);
router.post("/users/:id/follow", protect, authController.followUser);

module.exports = router;
