const { verifyAccessToken } = require("../utils/jwt");
const User = require("../models/User");
const { sendError } = require("../utils/apiResponse");

/**
 * Protect routes – verifies JWT access token from Authorization header or cookie
 */
const protect = async (req, res, next) => {
  try {
    let token;

    // Check Authorization header first
    if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      // Fallback: cookie-based token
      token = req.cookies.accessToken;
    }

    if (!token) {
      return sendError(res, "Access denied. No token provided.", 401);
    }

    const decoded = verifyAccessToken(token);
    const user = await User.findById(decoded.id).select("-password -refreshTokens");

    if (!user) {
      return sendError(res, "User no longer exists.", 401);
    }

    if (!user.isActive) {
      return sendError(res, "Your account has been deactivated.", 403);
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      return sendError(res, "Access token has expired. Please refresh.", 401);
    }
    return sendError(res, "Invalid token.", 401);
  }
};

/**
 * Optional auth – attaches user to req if token is present, but doesn't block
 */
const optionalAuth = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    } else if (req.cookies?.accessToken) {
      token = req.cookies.accessToken;
    }

    if (token) {
      const decoded = verifyAccessToken(token);
      req.user = await User.findById(decoded.id).select("-password -refreshTokens");
    }
  } catch (_) {
    // Ignore errors – user is simply unauthenticated
  }
  next();
};

/**
 * Role-based authorization – must be used after protect()
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, `Role '${req.user.role}' is not authorized for this action.`, 403);
    }
    next();
  };
};

/**
 * Resource ownership check helper
 */
const isOwnerOrAdmin = (resourceAuthorId, req) => {
  return (
    req.user.role === "admin" ||
    req.user._id.toString() === resourceAuthorId.toString()
  );
};

module.exports = { protect, optionalAuth, authorize, isOwnerOrAdmin };
