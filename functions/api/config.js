/**
 * GET /api/config
 * Cloudflare Pages Function — automatically routed from its file path.
 * Exposes only the public key_id to the frontend. KEY_SECRET never leaves the server.
 */
export async function onRequestGet(context) {
  const KEY_ID = context.env.RAZORPAY_KEY_ID;

  if (!KEY_ID) {
    return new Response(
      JSON.stringify({ success: false, error: 'RAZORPAY_KEY_ID is not configured.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return new Response(JSON.stringify({ key_id: KEY_ID }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}
