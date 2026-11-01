const cloudinary = require("cloudinary").v2;
const multer = require("multer");

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || "wcf0swtj";
const UPLOAD_PRESET = process.env.CLOUDINARY_UPLOAD_PRESET || "blog_folder";
const ASSET_FOLDER = process.env.CLOUDINARY_FOLDER || "blogs";

// Configure Cloudinary SDK
cloudinary.config({
  cloud_name: CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY || undefined,
  api_secret: process.env.CLOUDINARY_API_SECRET || undefined,
});

/**
 * Custom Multer storage engine for Cloudinary Unsigned Uploads
 */
class UnsignedCloudinaryStorage {
  constructor(options = {}) {
    this.preset = options.uploadPreset || UPLOAD_PRESET;
    this.folder = options.folder || ASSET_FOLDER;
  }

  _handleFile(req, file, cb) {
    const uploadOptions = {
      folder: this.folder,
    };

    const stream = cloudinary.uploader.unsigned_upload_stream(
      this.preset,
      uploadOptions,
      (error, result) => {
        if (error) {
          return cb(error);
        }
        cb(null, {
          path: result.secure_url,
          filename: result.public_id,
          publicId: result.public_id,
          size: result.bytes,
          format: result.format,
          width: result.width,
          height: result.height,
        });
      }
    );

    file.stream.pipe(stream);
  }

  _removeFile(req, file, cb) {
    cb(null);
  }
}

// Multer middleware for blog post cover images
const uploadPostImage = multer({
  storage: new UnsignedCloudinaryStorage({
    uploadPreset: UPLOAD_PRESET,
    folder: ASSET_FOLDER,
  }),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

// Multer middleware for user avatars
const uploadAvatar = multer({
  storage: new UnsignedCloudinaryStorage({
    uploadPreset: UPLOAD_PRESET,
    folder: `${ASSET_FOLDER}/avatars`,
  }),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

/**
 * Delete image from Cloudinary (requires API Key and Secret if signed)
 */
const deleteFromCloudinary = async (publicId) => {
  if (!publicId) return;
  if (!process.env.CLOUDINARY_API_SECRET) {
    // Unsigned mode does not support destroying assets from client/unauthenticated API
    return;
  }
  try {
    await cloudinary.uploader.destroy(publicId);
  } catch (error) {
    console.warn("Cloudinary delete skipped or error:", error.message);
  }
};

/**
 * Programmatic helper to upload a buffer/base64 or remote URL unsigned
 */
const uploadUnsigned = async (fileInput, customFolder = ASSET_FOLDER) => {
  return await cloudinary.uploader.unsigned_upload(fileInput, UPLOAD_PRESET, {
    folder: customFolder,
  });
};

module.exports = {
  cloudinary,
  uploadPostImage,
  uploadAvatar,
  deleteFromCloudinary,
  uploadUnsigned,
  CLOUD_NAME,
  UPLOAD_PRESET,
  ASSET_FOLDER,
};
