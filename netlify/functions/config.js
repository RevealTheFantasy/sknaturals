/**
 * GET /.netlify/functions/config  (mapped to /api/config via netlify.toml)
 * Exposes only the public key_id to the frontend. KEY_SECRET never leaves the server.
 */
exports.handler = async function (event) {
  const KEY_ID = process.env.RAZORPAY_KEY_ID;

  if (!KEY_ID) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'RAZORPAY_KEY_ID is not configured.' }),
    };
  }

  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key_id: KEY_ID }),
  };
};
