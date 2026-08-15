/**
 * POST /api/create-order
 * Cloudflare Pages Function — automatically routed from its file path.
 * Body: { amount (in paise), currency, receipt }
 *
 * Calls Razorpay's REST API directly with fetch() instead of the Node SDK,
 * since Cloudflare's edge runtime doesn't support Node-only packages.
 */
export async function onRequestPost(context) {
  const KEY_ID = context.env.RAZORPAY_KEY_ID;
  const KEY_SECRET = context.env.RAZORPAY_KEY_SECRET;

  if (!KEY_ID || !KEY_SECRET) {
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

  const parsedAmount = Number(payload.amount);

  if (!parsedAmount || !Number.isFinite(parsedAmount) || parsedAmount < 100) {
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Invalid amount. Amount must be an integer in paise and at least 100 (₹1).',
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  try {
    const authHeader = 'Basic ' + btoa(`${KEY_ID}:${KEY_SECRET}`);

    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify({
        amount: Math.round(parsedAmount),
        currency: payload.currency || 'INR',
        receipt: payload.receipt || `receipt_${Date.now()}`,
      }),
    });

    const order = await rzpRes.json();

    if (!rzpRes.ok) {
      const statusCode = rzpRes.status === 401 ? 401 : 500;
      const message = (order && order.error && order.error.description) || 'Failed to create Razorpay order.';
      return new Response(JSON.stringify({ success: false, error: message }), {
        status: statusCode,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: 'Failed to create Razorpay order.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
