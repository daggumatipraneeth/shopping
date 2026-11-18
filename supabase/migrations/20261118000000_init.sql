-- Schema for the shop: catalog, profiles, addresses, cart, orders.

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  category text not null check (category in ('book', 'dress')),
  description text not null default '',
  details text not null default '',          -- author / size / fabric, free text
  price numeric(10, 2) not null check (price > 0),
  image_url text not null default '',
  stock int not null default 0 check (stock >= 0),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  full_name text not null default '',
  phone text not null default '',
  is_admin boolean not null default false
);

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  name text not null,
  phone text not null,
  line1 text not null,
  line2 text not null default '',
  city text not null,
  state text not null,
  pincode text not null,
  created_at timestamptz not null default now()
);

create table public.cart_items (
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  product_id uuid not null references public.products on delete cascade,
  qty int not null check (qty > 0 and qty <= 20),
  primary key (user_id, product_id)
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users on delete cascade,
  address jsonb not null,
  amount_paise int not null check (amount_paise > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'shipped', 'cancelled')),
  razorpay_order_id text unique,
  razorpay_payment_id text,
  created_at timestamptz not null default now()
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders on delete cascade,
  product_id uuid references public.products on delete set null,
  name text not null,
  price numeric(10, 2) not null,
  qty int not null
);

-- Profile row for every new auth user.
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''));
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false)
$$;

-- Called by verify-payment and the webhook (service role only). Idempotent:
-- only a pending order flips to paid, so the second caller is a no-op.
create function public.mark_order_paid(p_rzp_order_id text, p_payment_id text) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  o public.orders;
begin
  update public.orders set status = 'paid', razorpay_payment_id = p_payment_id
   where razorpay_order_id = p_rzp_order_id and status = 'pending'
  returning * into o;
  if not found then
    return false;
  end if;

  -- ponytail: clamps at 0 if two buyers race for the last unit; add reservation on create-order if overselling matters
  update public.products p set stock = greatest(p.stock - oi.qty, 0)
    from public.order_items oi
   where oi.order_id = o.id and oi.product_id = p.id;

  delete from public.cart_items c
   using public.order_items oi
   where c.user_id = o.user_id and oi.order_id = o.id and c.product_id = oi.product_id;
  return true;
end $$;

revoke execute on function public.mark_order_paid(text, text) from public, anon, authenticated;

-- Row level security
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.addresses enable row level security;
alter table public.cart_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;

create policy "read active products" on public.products for select using (active or public.is_admin());
create policy "admin manages products" on public.products for all using (public.is_admin()) with check (public.is_admin());

create policy "own profile" on public.profiles for select using (id = auth.uid() or public.is_admin());
create policy "update own profile" on public.profiles for update using (id = auth.uid());
revoke update on public.profiles from anon, authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy "own addresses" on public.addresses for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own cart" on public.cart_items for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "read own orders" on public.orders for select using (user_id = auth.uid() or public.is_admin());
create policy "admin updates orders" on public.orders for update using (public.is_admin()) with check (public.is_admin());
revoke update on public.orders from anon, authenticated;
grant update (status) on public.orders to authenticated;

create policy "read own order items" on public.order_items for select using (
  exists (select 1 from public.orders o where o.id = order_id and (o.user_id = auth.uid() or public.is_admin()))
);
