/**
 * POST /.netlify/functions/create-order  (mapped to /api/create-order via netlify.toml)
 * Body: { amount (in paise), currency, receipt }
 */
const Razorpay = require('razorpay');

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ success: false, error: 'Method not allowed.' }) };
  }

  const KEY_ID = process.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
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

  const parsedAmount = Number(payload.amount);

  if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount < 100) {
    return {
      statusCode: 400,
      body: JSON.stringify({
        success: false,
        error: 'Invalid amount. Amount must be an integer in paise and at least 100 (₹1).',
      }),
    };
  }

  const razorpay = new Razorpay({ key_id: KEY_ID, key_secret: KEY_SECRET });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(parsedAmount),
      currency: payload.currency || 'INR',
      receipt: payload.receipt || `receipt_${Date.now()}`,
    });

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }),
    };
  } catch (err) {
    console.error('[create-order] error:', err);
    const statusCode = err && err.statusCode === 401 ? 401 : 500;
    const message =
      (err && err.error && err.error.description) || err.message || 'Failed to create Razorpay order.';

    return { statusCode, body: JSON.stringify({ success: false, error: message }) };
  }
};
