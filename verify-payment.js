/**
 * POST /.netlify/functions/verify-payment  (mapped to /api/verify-payment via netlify.toml)
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Signature check: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * must equal razorpay_signature. Only report success if it matches.
 */
const crypto = require('crypto');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed.' }) };
  }

  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_SECRET) {
    return {
      statusCode: 500,
      body: JSON.stringify({ success: false, error: 'Razorpay credentials are not configured on the server.' }),
    };
  }

  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ success: false, error: 'Invalid JSON body.' }) };
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = payload;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.',
      }),
    };
  }

  try {
    const generatedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );

    if (!isValid) {
      return {
        statusCode: 400,
        body: JSON.stringify({ success: false, error: 'Payment signature verification failed.' }),
      };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Payment verified successfully.' }),
    };
  } catch (err) {
    console.error('[verify-payment] error:', err);
    return {
      statusCode: 400,
      body: JSON.stringify({ success: false, error: 'Payment signature verification failed.' }),
    };
  }
};
