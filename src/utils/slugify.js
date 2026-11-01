/**
 * Convert a string to a URL-friendly slug
 */
const slugify = (text) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")       // spaces → dashes
    .replace(/[^\w\-]+/g, "")   // remove non-word chars
    .replace(/\-\-+/g, "-")     // collapse multiple dashes
    .replace(/^-+/, "")          // trim leading dash
    .replace(/-+$/, "");          // trim trailing dash
};

module.exports = slugify;
