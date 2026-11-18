# Books & Dresses

A small shop for books and dresses: a static site on GitHub Pages, with Supabase for the database, auth and edge functions, and Razorpay for payments.

- `index.html`: the catalog, with a Books/Dresses filter and search.
- `cart.html`: the cart. You pick an address and pay with Razorpay.
- `account.html`: login and sign up, profile, addresses and your orders.
- `admin.html`: admins add and edit products (images are links), hide products and mark orders shipped.

There is no build step. Edit the HTML and push. After changing `css/style.css` or anything in `js/`, bump the `?v=N` on every `style.css`, `common.js` and `config.js` reference (all pages plus `js/common.js`), or browsers may mix old and new files and the page won't render.

## Run locally

You need Docker, the [Supabase CLI](https://supabase.com/docs/guides/cli) and Python 3.

```bash
supabase start              # applies supabase/migrations + supabase/seed.sql
supabase functions serve    # edge functions (keep running)
python3 serve.py            # site → http://localhost:8000 (no browser caching)
```

- The ports are moved to 553xx (see `supabase/config.toml`) so this project can run next to another local Supabase project.
- `js/config.js` already points at the local stack.
- The local admin logs in at `admin.html` with username `admin`, password `admin123`.
- Studio runs at http://127.0.0.1:55323.

**Test mode:** with no Razorpay secret set, "Pay now" fakes a successful payment, so you can test the whole flow without keys. Once `RAZOR_PAY_SECRET` is set, fake payments are rejected automatically.

To use real Razorpay test keys locally, put them in a file outside the repo and pass it in. `../shopping.env` currently holds dhequest's **test** keys; replace them with this shop's own keys later.

```bash
supabase functions serve --env-file ../shopping.env
# RAZOR_PAY_KEY=rzp_test_xxx
# RAZOR_PAY_SECRET=xxx
# RAZOR_PAY_WEBHOOK_SECRET=xxx   (optional; falls back to RAZOR_PAY_SECRET)
```

## Deploy

1. **Supabase project:** create it, then:
   ```bash
   supabase link --project-ref <ref>
   supabase db push
   supabase secrets set RAZOR_PAY_KEY=rzp_live_xxx RAZOR_PAY_SECRET=xxx RAZOR_PAY_WEBHOOK_SECRET=xxx
   supabase functions deploy
   ```
   `razorpay-webhook` is deployed with JWT checks turned off (see `config.toml`).
2. **`js/config.js`:** it uses the local stack on localhost and the hosted project (`dxesxzwrrhqcgcqobvss`, Mumbai) everywhere else. For a different project, change the hosted `SUPABASE_URL` and anon key (Project Settings → API). The anon key is public and safe to commit.
3. **GitHub Pages:** go to Settings → Pages → Deploy from branch → `main` / root.
4. **Supabase Auth:** under Authentication → URL Configuration, set the Site URL to your Pages URL, for example `https://<user>.github.io/shopping/`.
5. **Razorpay webhook:** in Dashboard → Webhooks, set the URL to `https://<ref>.supabase.co/functions/v1/razorpay-webhook`, use the same secret as `RAZOR_PAY_WEBHOOK_SECRET`, and turn on the `payment.captured` and `order.paid` events.
6. **Make an admin:** admins are separate logins from customers.
   1. In Supabase, go to Authentication → Users → Add user.
   2. Enter email `<username>@shop.admin` (e.g. `admin@shop.admin`), choose a password and tick "Auto confirm".
   3. Run this in the SQL editor:
      ```sql
      update profiles set is_admin = true where id = (select id from auth.users where email = 'admin@shop.admin');
      ```
   4. Log in at `admin.html` with username `admin` and that password.

## Login protection

- **Customers and admin pass a Cloudflare Turnstile "verify you are human" check** on login and sign-up. Locally this uses Cloudflare's always-pass test keys (the widget says "For testing only"). To turn it on for the hosted site:
  1. In Cloudflare → Turnstile → Add widget, add the hostname `daggumatipraneeth.github.io` (plus `localhost` if you like). You get a **site key** (public) and a **secret key**.
  2. In Supabase → Authentication → Attack Protection, enable CAPTCHA protection, choose Turnstile and paste the **secret key**.
  3. Put the **site key** in `js/config.js` (`TURNSTILE_SITE_KEY`, hosted branch) and bump `?v=N`.
  Do steps 2 and 3 together: with only one of them done, logins fail.
- **Admin uses two-step login.** The first admin login shows a QR code for an authenticator app; every later login asks for its 6-digit code. The database only grants admin rights after that code (`is_admin()` requires an `aal2` session), so a password alone can't change products or read orders.
- **Lost the authenticator phone?** Remove the admin's factor in the SQL editor: `delete from auth.mfa_factors where user_id = (select id from auth.users where email = 'admin@shop.admin');`. The next login shows a new QR code.

## How payment works

The flow is ported from dhequest's checkout.

1. `create-order` calculates the total from database prices (never the browser's), saves a `pending` order and creates a Razorpay order.
2. Razorpay Checkout opens in the browser.
3. `verify-payment` checks `HMAC-SHA256(order_id|payment_id, key_secret)`.
4. `mark_order_paid()` sets the order to paid, reduces stock and clears the cart.
5. The webhook is a backup if the browser closes before step 3. It calls the same `mark_order_paid()`, and the first call wins.

Security comes from the row-level security rules in `supabase/migrations`:
- Customers can only see their own cart, addresses and orders.
- Only admins can change products or order status.
- Nobody can make themselves an admin.
