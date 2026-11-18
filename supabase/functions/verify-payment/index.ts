// Called from the Razorpay Checkout handler. Verifies HMAC(order_id|payment_id) and marks the order paid.
import { admin, hmacHex, json, KEY_SECRET, MOCK, preflight, safeEqual, userFrom } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const user = await userFrom(req);
  if (!user) return json({ error: "Please log in" }, 401);

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = await req.json().catch(() => ({}));
  if (!razorpay_order_id || !razorpay_payment_id) return json({ error: "Missing payment details" }, 400);

  const { data: order } = await admin.from("orders").select("id, status")
    .eq("razorpay_order_id", razorpay_order_id).eq("user_id", user.id).maybeSingle();
  if (!order) return json({ error: "Order not found" }, 404);

  const valid = MOCK
    ? razorpay_order_id.startsWith("mock_")
    : safeEqual(await hmacHex(KEY_SECRET, `${razorpay_order_id}|${razorpay_payment_id}`), razorpay_signature);
  if (!valid) return json({ error: "Invalid payment signature" }, 400);

  // Returns false if the webhook already marked it paid; that's still success.
  const { error } = await admin.rpc("mark_order_paid", { p_rzp_order_id: razorpay_order_id, p_payment_id: razorpay_payment_id });
  if (error) return json({ error: error.message }, 500);
  return json({ ok: true, order_id: order.id });
});
