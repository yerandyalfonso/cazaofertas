-- Affiliate click tracking: article context + admin/test flag

alter table public.affiliate_clicks
  add column if not exists article_id uuid references public.articles(id) on delete set null;

alter table public.affiliate_clicks
  add column if not exists is_test boolean not null default false;

create index if not exists idx_affiliate_clicks_created_at
  on public.affiliate_clicks (created_at desc);

create index if not exists idx_affiliate_clicks_product_id
  on public.affiliate_clicks (product_id);

create index if not exists idx_affiliate_clicks_is_test
  on public.affiliate_clicks (is_test);

create index if not exists idx_affiliate_clicks_article_id
  on public.affiliate_clicks (article_id)
  where article_id is not null;
