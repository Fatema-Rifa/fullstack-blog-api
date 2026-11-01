const User = require("../models/User");
const Follow = require("../models/Follow");
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} = require("../utils/jwt");
const { sendSuccess, sendError } = require("../utils/apiResponse");
const { uploadAvatar, deleteFromCloudinary } = require("../config/cloudinary");
const { verifyFirebaseToken } = require("../utils/firebaseAuth");

// ─────────────────────────────────────────────────────────────────────────────
// Helper: set refresh token cookie
// ─────────────────────────────────────────────────────────────────────────────
const setRefreshTokenCookie = (res, token) => {
  res.cookie("refreshToken", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/register
// ─────────────────────────────────────────────────────────────────────────────
exports.register = async (req, res, next) => {
  try {
    const { username, email, password, name } = req.body;

    const user = await User.create({ username, email, password, name });

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Store hashed refresh token in DB
    await User.findByIdAndUpdate(user._id, {
      $push: { refreshTokens: refreshToken },
    });

    setRefreshTokenCookie(res, refreshToken);

    return sendSuccess(
      res,
      { accessToken, user },
      "Registration successful",
      201
    );
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/login
// ─────────────────────────────────────────────────────────────────────────────
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password +refreshTokens");
    if (!user || !(await user.comparePassword(password))) {
      return sendError(res, "Invalid email or password.", 401);
    }

    if (!user.isActive) {
      return sendError(res, "Your account has been deactivated.", 403);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    // Limit stored refresh tokens to last 5 devices
    const tokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await User.findByIdAndUpdate(user._id, { refreshTokens: tokens });

    setRefreshTokenCookie(res, refreshToken);

    const userObj = user.toJSON();

    return sendSuccess(res, { accessToken, user: userObj }, "Login successful");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/refresh
// ─────────────────────────────────────────────────────────────────────────────
exports.refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;
    if (!token) return sendError(res, "No refresh token provided.", 401);

    const decoded = verifyRefreshToken(token);

    const user = await User.findById(decoded.id).select("+refreshTokens");
    if (!user || !user.refreshTokens.includes(token)) {
      return sendError(res, "Invalid refresh token.", 401);
    }

    // Rotate refresh token
    const newAccessToken = generateAccessToken(user._id);
    const newRefreshToken = generateRefreshToken(user._id);

    const updatedTokens = user.refreshTokens.filter((t) => t !== token);
    updatedTokens.push(newRefreshToken);
    await User.findByIdAndUpdate(user._id, { refreshTokens: updatedTokens.slice(-5) });

    setRefreshTokenCookie(res, newRefreshToken);

    return sendSuccess(res, { accessToken: newAccessToken }, "Token refreshed");
  } catch (error) {
    if (error.name === "TokenExpiredError" || error.name === "JsonWebTokenError") {
      return sendError(res, "Invalid or expired refresh token.", 401);
    }
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/logout
// ─────────────────────────────────────────────────────────────────────────────
exports.logout = async (req, res, next) => {
  try {
    const token = req.cookies?.refreshToken || req.body.refreshToken;

    if (token && req.user) {
      await User.findByIdAndUpdate(req.user._id, {
        $pull: { refreshTokens: token },
      });
    }

    res.clearCookie("refreshToken");
    res.clearCookie("accessToken");

    return sendSuccess(res, {}, "Logged out successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/auth/me
// ─────────────────────────────────────────────────────────────────────────────
exports.getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);
    return sendSuccess(res, { user }, "Current user fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/update-profile
// ─────────────────────────────────────────────────────────────────────────────
exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ["name", "bio", "username"];
    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    // Handle avatar upload
    if (req.file) {
      const oldPublicId = req.user.avatar?.publicId;
      if (oldPublicId) await deleteFromCloudinary(oldPublicId);
      updates.avatar = {
        url: req.file.path,
        publicId: req.file.filename || req.file.publicId || "",
      };
    } else if (req.body.avatar) {
      try {
        const av = typeof req.body.avatar === "string" ? JSON.parse(req.body.avatar) : req.body.avatar;
        updates.avatar = {
          url: av.url || av,
          publicId: av.publicId || "",
        };
      } catch (_) {
        updates.avatar = { url: req.body.avatar, publicId: "" };
      }
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    return sendSuccess(res, { user }, "Profile updated");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// PUT /api/auth/change-password
// ─────────────────────────────────────────────────────────────────────────────
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select("+password");
    if (!(await user.comparePassword(currentPassword))) {
      return sendError(res, "Current password is incorrect.", 400);
    }

    user.password = newPassword;
    await user.save();

    return sendSuccess(res, {}, "Password changed successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /api/users/:username – Public profile
// ─────────────────────────────────────────────────────────────────────────────
exports.getUserProfile = async (req, res, next) => {
  try {
    const user = await User.findOne({ username: req.params.username });
    if (!user) return sendError(res, "User not found.", 404);

    let isFollowing = false;
    if (req.user) {
      isFollowing = !!(await Follow.findOne({
        follower: req.user._id,
        following: user._id,
      }));
    }

    return sendSuccess(res, { user, isFollowing }, "User profile fetched");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/users/:id/follow
// ─────────────────────────────────────────────────────────────────────────────
exports.followUser = async (req, res, next) => {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return sendError(res, "You cannot follow yourself.", 400);
    }

    const target = await User.findById(targetId);
    if (!target) return sendError(res, "User not found.", 404);

    const existing = await Follow.findOne({ follower: req.user._id, following: targetId });
    if (existing) {
      // Unfollow
      await existing.deleteOne();
      await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: -1 } });
      await User.findByIdAndUpdate(targetId, { $inc: { followersCount: -1 } });
      return sendSuccess(res, { following: false }, "Unfollowed successfully");
    }

    await Follow.create({ follower: req.user._id, following: targetId });
    await User.findByIdAndUpdate(req.user._id, { $inc: { followingCount: 1 } });
    await User.findByIdAndUpdate(targetId, { $inc: { followersCount: 1 } });

    return sendSuccess(res, { following: true }, "Followed successfully");
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/auth/firebase
// ─────────────────────────────────────────────────────────────────────────────
exports.firebaseAuth = async (req, res, next) => {
  try {
    const { idToken, username: preferredUsername, name: preferredName } = req.body;
    if (!idToken) {
      return sendError(res, "Firebase ID token is required.", 400);
    }

    const decoded = await verifyFirebaseToken(idToken);
    const { uid, email, name: fbName, picture } = decoded;

    if (!email) {
      return sendError(res, "Firebase account does not have an associated email.", 400);
    }

    // Check if user exists by firebaseUid OR email
    let user = await User.findOne({
      $or: [{ firebaseUid: uid }, { email: email.toLowerCase() }],
    }).select("+refreshTokens");

    if (user) {
      // If user was previously registered, link their firebaseUid
      if (!user.firebaseUid) {
        user.firebaseUid = uid;
      }
      // If avatar not set and Firebase provides picture
      if (!user.avatar?.url && picture) {
        user.avatar = { url: picture, publicId: "" };
      }
      // If name not set and Firebase provides name
      if (!user.name && (preferredName || fbName)) {
        user.name = preferredName || fbName;
      }
      await user.save();
    } else {
      // Create new user: generate a clean, unique username
      let baseUsername = (preferredUsername || fbName || email.split("@")[0])
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, "")
        .slice(0, 20);

      if (!baseUsername || baseUsername.length < 3) {
        baseUsername = `user_${uid.slice(0, 6)}`;
      }

      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await User.exists({ username: uniqueUsername })) {
        uniqueUsername = `${baseUsername}${counter}`;
        counter++;
      }

      user = await User.create({
        username: uniqueUsername,
        email: email.toLowerCase(),
        firebaseUid: uid,
        name: preferredName || fbName || uniqueUsername,
        avatar: picture ? { url: picture, publicId: "" } : { url: "", publicId: "" },
      });
    }

    if (!user.isActive) {
      return sendError(res, "Your account has been deactivated.", 403);
    }

    const accessToken = generateAccessToken(user._id);
    const refreshToken = generateRefreshToken(user._id);

    const tokens = [...(user.refreshTokens || []), refreshToken].slice(-5);
    await User.findByIdAndUpdate(user._id, { refreshTokens: tokens });

    setRefreshTokenCookie(res, refreshToken);

    const userObj = user.toJSON();

    return sendSuccess(res, { accessToken, user: userObj }, "Authentication successful");
  } catch (error) {
    if (error.name === "JsonWebTokenError" || error.name === "TokenExpiredError") {
      return sendError(res, "Invalid or expired Firebase token.", 401);
    }
    next(error);
  }
};

