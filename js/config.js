// Public values only (safe to commit). Local values come from `supabase status`.
export const SHOP_NAME = 'Books & Dresses';

const isLocal = ['localhost', '127.0.0.1'].includes(location.hostname);

// Cloudflare Turnstile site key (public). Local uses Cloudflare's always-pass test key.
// Hosted: paste the site key from Cloudflare → Turnstile; leave '' until captcha is enabled in Supabase.
export const TURNSTILE_SITE_KEY = isLocal ? '1x00000000000000000000AA' : '';

export const SUPABASE_URL = isLocal ? 'http://127.0.0.1:55321' : 'https://dxesxzwrrhqcgcqobvss.supabase.co';
export const SUPABASE_ANON_KEY = isLocal
  ? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
  : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR4ZXN4endycmhxY2djcW9idnNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTUwMDU3NzEsImV4cCI6MjExMDU4MTc3MX0.zu5YOZexR4jbdvjB35QfgcL1jixQIWTEElcEJjVBQ1w';
