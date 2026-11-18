// Turns the caller's cart into a pending order and a Razorpay order.
// Amount is computed here from DB prices; the client never sends a price.
import { admin, json, KEY_ID, KEY_SECRET, MOCK, preflight, userFrom } from "../_shared/razorpay.ts";

Deno.serve(async (req) => {
  const pre = preflight(req);
  if (pre) return pre;
  const user = await userFrom(req);
  if (!user) return json({ error: "Please log in" }, 401);

  const { address_id } = await req.json().catch(() => ({}));
  const { data: address } = await admin.from("addresses")
    .select("name, phone, line1, line2, city, state, pincode")
    .eq("id", address_id).eq("user_id", user.id).maybeSingle();
  if (!address) return json({ error: "Choose a delivery address" }, 400);

  const { data: cart } = await admin.from("cart_items")
    .select("qty, products(id, name, price, stock, active)").eq("user_id", user.id);
  if (!cart?.length) return json({ error: "Your cart is empty" }, 400);

  // deno-lint-ignore no-explicit-any
  const lines = cart.map((c: any) => ({ qty: c.qty, p: c.products }));
  for (const { qty, p } of lines) {
    if (!p.active) return json({ error: `${p.name} is no longer available` }, 400);
    if (p.stock < qty) return json({ error: `Only ${p.stock} left of ${p.name}` }, 400);
  }
  const amount = Math.round(lines.reduce((s, { qty, p }) => s + Number(p.price) * qty, 0) * 100);

  const { data: order, error } = await admin.from("orders")
    .insert({ user_id: user.id, address, amount_paise: amount }).select().single();
  if (error) return json({ error: error.message }, 500);
  await admin.from("order_items").insert(
    lines.map(({ qty, p }) => ({ order_id: order.id, product_id: p.id, name: p.name, price: p.price, qty })),
  );

  let rzpOrderId = `mock_${order.id}`;
  if (!MOCK) {
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${btoa(`${KEY_ID}:${KEY_SECRET}`)}` },
      body: JSON.stringify({ amount, currency: "INR", receipt: order.id, payment_capture: 1 }),
    });
    const rzp = await res.json();
    if (!res.ok) {
      await admin.from("orders").update({ status: "cancelled" }).eq("id", order.id);
      return json({ error: rzp.error?.description ?? "Payment gateway error" }, 502);
    }
    rzpOrderId = rzp.id;
  }
  await admin.from("orders").update({ razorpay_order_id: rzpOrderId }).eq("id", order.id);

  return json({ mock: MOCK, key: KEY_ID, order_id: order.id, razorpay_order_id: rzpOrderId, amount, currency: "INR" });
});
