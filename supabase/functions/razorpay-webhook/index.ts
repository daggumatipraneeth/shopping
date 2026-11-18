// Backup path if the browser closes before verify-payment runs. Deployed with verify_jwt = false.
import { admin, hmacHex, safeEqual, WEBHOOK_SECRET } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  if (!WEBHOOK_SECRET) return new Response("webhook secret not set", { status: 500 });
  const raw = await req.text();
  if (!safeEqual(await hmacHex(WEBHOOK_SECRET, raw), req.headers.get("x-razorpay-signature"))) {
    return new Response("invalid signature", { status: 400 });
  }

  const event = JSON.parse(raw);
  const payment = event.payload?.payment?.entity;
  if ((event.event === "payment.captured" || event.event === "order.paid") && payment?.order_id) {
    const { error } = await admin.rpc("mark_order_paid", { p_rzp_order_id: payment.order_id, p_payment_id: payment.id });
    if (error) return new Response(error.message, { status: 500 }); // Razorpay retries
  }
  return new Response("ok");
});
