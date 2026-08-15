/**
 * SK Naturals Beauty Parlour — Backend
 * Serves the static site and provides two Razorpay endpoints:
 *   POST /api/create-order    -> creates a Razorpay order
 *   POST /api/verify-payment  -> verifies the payment signature after checkout
 *
 * Run:
 *   npm install
 *   npm start
 * Then open http://localhost:3000
 */

require('dotenv').config();

const path = require('path');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const Razorpay = require('razorpay');

const app = express();
const PORT = process.env.PORT || 3000;

const KEY_ID = process.env.RAZORPAY_KEY_ID;
const KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

if (!KEY_ID || !KEY_SECRET) {
  console.error(
    '[FATAL] RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET are missing.\n' +
    'Create a .env file (see .env.example) with your Razorpay credentials before starting the server.'
  );
  process.exit(1);
}

const razorpay = new Razorpay({
  key_id: KEY_ID,
  key_secret: KEY_SECRET,
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname))); // serves index.html and other static assets

/**
 * GET /api/config
 * Exposes only the public key_id to the frontend. KEY_SECRET never leaves the server.
 */
app.get('/api/config', (req, res) => {
  res.json({ key_id: KEY_ID });
});

/**
 * POST /api/create-order
 * Body: { amount (in paise), currency, receipt }
 */
app.post('/api/create-order', async (req, res) => {
  try {
    const { amount, currency, receipt } = req.body || {};

    const parsedAmount = Number(amount);

    if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount < 100) {
      return res.status(400).json({
        success: false,
        error: 'Invalid amount. Amount must be an integer in paise and at least 100 (₹1).',
      });
    }

    const options = {
      amount: Math.round(parsedAmount), // amount in the smallest currency unit (paise)
      currency: currency || 'INR',
      receipt: receipt || `receipt_${Date.now()}`,
    };

    const order = await razorpay.orders.create(options);

    return res.status(200).json({
      success: true,
      order_id: order.id,
      amount: order.amount,
      currency: order.currency,
    });
  } catch (err) {
    console.error('[create-order] error:', err);

    // Razorpay auth failures typically surface as 401 from their API
    const statusCode = err && err.statusCode === 401 ? 401 : 500;
    const message =
      (err && err.error && err.error.description) ||
      err.message ||
      'Failed to create Razorpay order.';

    return res.status(statusCode).json({ success: false, error: message });
  }
});

/**
 * POST /api/verify-payment
 * Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 *
 * Signature check: HMAC-SHA256(order_id + "|" + payment_id, KEY_SECRET)
 * must equal razorpay_signature. Only mark payment as verified if it matches.
 */
app.post('/api/verify-payment', (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: razorpay_order_id, razorpay_payment_id, razorpay_signature.',
      });
    }

    const generatedSignature = crypto
      .createHmac('sha256', KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const isValid = crypto.timingSafeEqual(
      Buffer.from(generatedSignature, 'utf8'),
      Buffer.from(razorpay_signature, 'utf8')
    );

    if (!isValid) {
      return res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
    }

    // Signature verified — this is the point where you would mark the
    // enrollment/order as paid in your own storage (none exists in this project yet).
    return res.status(200).json({ success: true, message: 'Payment verified successfully.' });
  } catch (err) {
    console.error('[verify-payment] error:', err);
    // A length mismatch in timingSafeEqual throws — treat any error here as an invalid signature.
    return res.status(400).json({ success: false, error: 'Payment signature verification failed.' });
  }
});

app.listen(PORT, () => {
  console.log(`SK Naturals server running at http://localhost:${PORT}`);
});
