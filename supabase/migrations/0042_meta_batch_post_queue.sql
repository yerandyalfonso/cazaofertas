-- Publicación en Facebook/Instagram por lotes (carrusel de N productos en
-- un solo post) en vez de un post individual por chollo. Meta bloqueó
-- temporalmente la página por volumen de publicación (368/9); publicar en
-- lotes de N reduce drásticamente el número de llamadas a la API.

alter table app_settings
  add column if not exists meta_batch_size smallint not null default 10;

create table if not exists meta_post_queue (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  score numeric(6, 2) not null default 0,
  old_price numeric(10, 2),
  new_price numeric(10, 2) not null,
  discount_percentage numeric(6, 2),
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  posted_at timestamptz,
  constraint meta_post_queue_status_check
    check (status in ('pending', 'posted', 'skipped'))
);

create index if not exists idx_meta_post_queue_status_created
  on meta_post_queue (status, created_at);

-- Evita encolar el mismo producto dos veces mientras está pendiente.
create unique index if not exists idx_meta_post_queue_pending_product
  on meta_post_queue (product_id)
  where status = 'pending';

alter table meta_post_queue enable row level security;
