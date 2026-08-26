-- Blog articles (CMS columns) + linked catalog products

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text not null,
  content jsonb not null default '[]'::jsonb,
  featured_image text,
  author text not null default 'CazaOferta',
  category text not null,
  status text not null default 'draft',
  seo_title text,
  seo_description text,
  reading_time integer not null default 5,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint articles_status_check check (
    status in ('draft', 'published', 'archived')
  )
);

create table if not exists public.article_products (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (article_id, product_id)
);

create index if not exists idx_articles_status
  on public.articles (status, updated_at desc);

create index if not exists idx_articles_category
  on public.articles (category);

create index if not exists idx_article_products_article
  on public.article_products (article_id, position);

drop trigger if exists trg_articles_updated_at on public.articles;
create trigger trg_articles_updated_at
  before update on public.articles
  for each row
  execute function public.set_updated_at();
