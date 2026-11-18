import { SHOP_NAME, SUPABASE_URL, SUPABASE_ANON_KEY, TURNSTILE_SITE_KEY } from './config.js?v=7';

// supabase-js is loaded as a plain <script> in each page (one file; the +esm build trips Safari).
const { createClient } = window.supabase;

// The admin page keeps its own login session, separate from the customer one.
export const ADMIN_PAGE = location.pathname.endsWith('admin.html');
export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { storageKey: ADMIN_PAGE ? 'shop-admin-auth' : 'shop-customer-auth' },
});
export const $ = (sel) => document.querySelector(sel);

export const rupees = (n) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 });

// Everything rendered with innerHTML goes through esc().
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export async function getUser() {
  const { data } = await sb.auth.getSession();
  return data.session?.user ?? null;
}

export async function isAdmin(user) {
  if (!user) return false;
  const { data } = await sb.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
  return !!data?.is_admin;
}

export function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = 'toast' + (isError ? ' error' : '');
  el.setAttribute('role', 'status');
  el.textContent = msg;
  document.body.append(el);
  setTimeout(() => el.remove(), 3500);
}

export async function cartCount() {
  const user = await getUser();
  if (!user) return 0;
  const { data } = await sb.from('cart_items').select('qty');
  return (data ?? []).reduce((s, r) => s + r.qty, 0);
}

export async function refreshCartBadge() {
  const n = await cartCount();
  const badge = $('#cart-count');
  if (badge) badge.textContent = n || '';
}

// Adds one unit of a product (row from `products`) to the cart; sends logged-out users to login.
export async function addToCart(product) {
  const user = await getUser();
  if (!user) return (location.href = `account.html?next=${encodeURIComponent(location.pathname.split('/').pop() + location.search)}`);
  const { data: existing } = await sb.from('cart_items').select('qty').eq('product_id', product.id).maybeSingle();
  const qty = (existing?.qty ?? 0) + 1;
  if (qty > product.stock) return toast(`Only ${product.stock} in stock`, true);
  const { error } = await sb.from('cart_items').upsert({ user_id: user.id, product_id: product.id, qty });
  if (error) return toast(error.message, true);
  toast(`Added ${product.name} to cart`);
  refreshCartBadge();
}

// Cloudflare Turnstile "are you human" check inside a login/sign-up form. Supabase verifies the
// token, so every sign-in and sign-up must pass one. No-op when no site key is configured.
export function mountCaptcha(container) {
  if (!TURNSTILE_SITE_KEY) return { token: () => undefined, reset() {} };
  let token, id;
  const script = document.createElement('script');
  script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
  script.onload = () => {
    id = window.turnstile.render(container, {
      sitekey: TURNSTILE_SITE_KEY,
      callback: (t) => (token = t),
      'expired-callback': () => (token = undefined),
    });
  };
  document.head.append(script);
  return {
    token: () => token,
    // A token works once; get a fresh one after every attempt.
    reset() { token = undefined; if (id !== undefined) window.turnstile.reset(id); },
  };
}

// Calls an edge function; throws with the server's error message.
export async function callFn(name, body) {
  const { data, error } = await sb.functions.invoke(name, { body });
  if (error) {
    const msg = await error.context?.json?.().then((j) => j.error).catch(() => null);
    throw new Error(msg || error.message);
  }
  return data;
}

const icon = (paths) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

export async function renderHeader() {
  const user = await getUser();
  document.title = document.title ? `${document.title} · ${SHOP_NAME}` : SHOP_NAME;
  const here = location.pathname.split('/').pop() || 'index.html';
  const current = (href) => (href === here ? ' aria-current="page"' : '');
  $('header').innerHTML = ADMIN_PAGE
    ? `<a class="brand" href="admin.html">${esc(SHOP_NAME)} admin</a>
       <nav>${user ? '<button class="small secondary" id="admin-logout">Log out</button>' : ''}</nav>`
    : `<a class="brand" href="index.html" aria-label="${esc(SHOP_NAME)} home">${esc(SHOP_NAME)}</a>
       <nav>
         <a href="cart.html" class="icon-link" aria-label="Cart"${current('cart.html')}>
           ${icon('<circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.7 13.4a2 2 0 0 0 2 1.6h9.7a2 2 0 0 0 2-1.6L23 6H6"/>')}
           <span id="cart-count"></span>
         </a>
         <a href="account.html" class="icon-link" aria-label="${user ? 'Account' : 'Log in'}"${current('account.html')}>
           ${icon('<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8"/>')}
         </a>
       </nav>`;
  $('#admin-logout')?.addEventListener('click', async () => { await sb.auth.signOut(); location.reload(); });
  if (!ADMIN_PAGE && !document.querySelector('footer')) {
    document.body.insertAdjacentHTML('beforeend', `
      <footer>
        <a class="brand" href="index.html">${esc(SHOP_NAME)}</a>
        <p>Books and dresses, delivered across India. Secure payments by Razorpay.</p>
      </footer>`);
  }
  if (!ADMIN_PAGE) refreshCartBadge();
  return user;
}
