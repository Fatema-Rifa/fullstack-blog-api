const { validationResult } = require("express-validator");
const { sendError } = require("../utils/apiResponse");

/**
 * Runs express-validator checks and returns formatted errors if any
 */
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const formatted = errors.array().map((e) => ({ field: e.path, message: e.msg }));
    return sendError(res, "Validation failed", 422, formatted);
  }
  next();
};

module.exports = validate;
