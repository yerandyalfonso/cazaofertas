-- CazaOferta initial schema (Phase 1)

create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text,
  image_url text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  asin text not null unique,
  title text not null,
  slug text not null unique,
  description text,
  image_url text,
  amazon_url text not null,
  affiliate_url text,
  brand text,
  category_id uuid references public.categories(id) on delete set null,
  current_price numeric(10, 2) not null,
  previous_price numeric(10, 2),
  lowest_price numeric(10, 2),
  highest_price numeric(10, 2),
  discount_percentage numeric(6, 2),
  currency text not null default 'EUR',
  availability text not null default 'IN_STOCK',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  is_active boolean not null default true,
  is_featured boolean not null default false,
  constraint products_availability_check check (
    availability in ('IN_STOCK', 'OUT_OF_STOCK', 'PREORDER', 'UNKNOWN')
  )
);

create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  price numeric(10, 2) not null,
  timestamp timestamptz not null default now(),
  source text not null default 'mock',
  constraint price_history_source_check check (
    source in ('seed', 'mock', 'amazon', 'keepa')
  )
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique,
  telegram_username text,
  email text,
  created_at timestamptz not null default now(),
  last_active_at timestamptz
);

create table if not exists public.alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  category_id uuid references public.categories(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  brand text,
  keyword text,
  min_discount_percentage numeric(6, 2),
  max_price numeric(10, 2),
  min_price numeric(10, 2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  alert_id uuid references public.alerts(id) on delete set null,
  old_price numeric(10, 2),
  new_price numeric(10, 2) not null,
  discount_percentage numeric(6, 2),
  sent_at timestamptz,
  status text not null default 'pending'
);

create table if not exists public.affiliate_clicks (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  user_id uuid references public.users(id) on delete set null,
  source text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_products_category_id on public.products (category_id);
create index if not exists idx_products_is_active on public.products (is_active);
create index if not exists idx_products_slug on public.products (slug);
create index if not exists idx_price_history_product_timestamp
  on public.price_history (product_id, timestamp desc);
create index if not exists idx_alerts_user_id on public.alerts (user_id);
create index if not exists idx_alerts_is_active on public.alerts (is_active);
create index if not exists idx_notifications_user_product
  on public.notifications (user_id, product_id, status);

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
  before update on public.products
  for each row
  execute procedure public.set_updated_at();

drop trigger if exists alerts_set_updated_at on public.alerts;
create trigger alerts_set_updated_at
  before update on public.alerts
  for each row
  execute procedure public.set_updated_at();

alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.price_history enable row level security;
alter table public.users enable row level security;
alter table public.alerts enable row level security;
alter table public.notifications enable row level security;
alter table public.affiliate_clicks enable row level security;

drop policy if exists "Public can read active categories" on public.categories;
create policy "Public can read active categories"
  on public.categories
  for select
  using (is_active = true);

drop policy if exists "Public can read active products" on public.products;
create policy "Public can read active products"
  on public.products
  for select
  using (is_active = true);

drop policy if exists "Public can read price history" on public.price_history;
create policy "Public can read price history"
  on public.price_history
  for select
  using (
    exists (
      select 1
      from public.products
      where products.id = price_history.product_id
        and products.is_active = true
    )
  );
