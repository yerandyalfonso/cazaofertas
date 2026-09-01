-- Cupones por tienda (marketplace Chollos de Hoy + detección automática).

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  retailer text not null,
  title text not null,
  code text not null,
  description text not null default '',
  url text not null,
  starts_at date,
  expires_at date,
  highlight boolean not null default false,
  source text not null default 'manual'
    check (source in ('manual', 'scrape', 'affiliate')),
  is_active boolean not null default true,
  external_id text,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint coupons_retailer_code_key unique (retailer, code)
);

create index if not exists coupons_retailer_active_idx
  on public.coupons (retailer, is_active, expires_at);

create index if not exists coupons_active_dates_idx
  on public.coupons (is_active, starts_at, expires_at);

comment on table public.coupons is
  'Cupones y códigos de descuento por tienda (Chollos de Hoy).';

alter table public.coupons enable row level security;

drop policy if exists "Public can read active coupons" on public.coupons;
create policy "Public can read active coupons"
  on public.coupons
  for select
  to anon, authenticated
  using (
    is_active = true
    and (starts_at is null or starts_at <= current_date)
    and (expires_at is null or expires_at >= current_date)
  );

-- Sin seed de ejemplos: los cupones llegan vía npm run coupons:discover / cron.
