/**
 * POST /api/verify-payment
 * Cloudflare Pages Function — automatically routed from its file path.
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Signature check: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * must equal razorpay_signature. Uses the Web Crypto API (crypto.subtle)
 * since Cloudflare's edge runtime doesn't support Node's 'crypto' module.
 */

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function onRequestPost(context) {
  const KEY_SECRET = context.env.RAZORPAY_KEY_SECRET;

  if (!KEY_SECRET) {
    return new Response(
      JSON.stringify({ success: false, error: 'Razorpay credentials are not configured on the server.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  let payload;
  try {
    payload = await context.request.json();
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: 'Invalid JSON body.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload || {};

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(KEY_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signatureBuffer = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(`${razorpay_order_id}|${razorpay_payment_id}`)
    );

    const generatedSignature = toHex(signatureBuffer);
    const isValid = timingSafeEqual(generatedSignature, razorpay_signature);

    if (!isValid) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment signature verification failed.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment verified successfully.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Payment signature verification failed.' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
