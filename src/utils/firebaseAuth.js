const jwt = require("jsonwebtoken");

const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let certsExpiry = 0;

/**
 * Fetch and cache Google's public x509 certificates for Firebase ID token verification
 */
const getGooglePublicCerts = async () => {
  const now = Date.now();
  if (cachedCerts && now < certsExpiry) {
    return cachedCerts;
  }

  try {
    const response = await fetch(GOOGLE_CERTS_URL);
    if (!response.ok) {
      throw new Error(`Failed to fetch Google certificates: ${response.statusText}`);
    }

    // Parse Cache-Control header for max-age if available
    const cacheControl = response.headers.get("cache-control");
    let maxAgeSeconds = 3600 * 6; // Default 6 hours
    if (cacheControl) {
      const match = cacheControl.match(/max-age=(\d+)/i);
      if (match && match[1]) {
        maxAgeSeconds = parseInt(match[1], 10);
      }
    }

    cachedCerts = await response.json();
    certsExpiry = now + maxAgeSeconds * 1000;
    return cachedCerts;
  } catch (error) {
    if (cachedCerts) {
      return cachedCerts; // Return stale cache if network error occurs
    }
    throw error;
  }
};

/**
 * Verify a Firebase ID token
 * @param {string} idToken - The Firebase ID token sent from the client
 * @param {string} [projectId] - Optional project ID (defaults to env or configured app)
 * @returns {Promise<object>} The decoded payload if valid
 */
const verifyFirebaseToken = async (idToken, projectId = process.env.FIREBASE_PROJECT_ID || "my-blogging-app-b2eb9") => {
  if (!idToken || typeof idToken !== "string") {
    throw new Error("Missing or invalid Firebase ID token");
  }

  // 1. Decode header to find 'kid' (key ID)
  const decodedHeader = jwt.decode(idToken, { complete: true });
  if (!decodedHeader || !decodedHeader.header || !decodedHeader.header.kid) {
    throw new Error("Invalid token format or missing key ID (kid)");
  }

  const { kid, alg } = decodedHeader.header;
  if (alg !== "RS256") {
    throw new Error(`Invalid token algorithm: ${alg}. Expected RS256.`);
  }

  // 2. Fetch public certificates from Google
  const certs = await getGooglePublicCerts();
  const cert = certs[kid];

  if (!cert) {
    throw new Error(`No matching public key found for kid: ${kid}`);
  }

  // 3. Verify signature, audience, and issuer
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const decoded = jwt.verify(idToken, cert, {
    algorithms: ["RS256"],
    audience: projectId,
    issuer: expectedIssuer,
  });

  const uid = decoded.uid || decoded.user_id || decoded.sub;

  return {
    ...decoded,
    uid,
  };
};

module.exports = {
  verifyFirebaseToken,
  getGooglePublicCerts,
};
