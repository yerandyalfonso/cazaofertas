-- Align article_products with CMS columns (position, not sort_order)

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'article_products'
      and column_name = 'sort_order'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'article_products'
      and column_name = 'position'
  ) then
    alter table public.article_products rename column sort_order to position;
  end if;

  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'article_products'
  ) then
    alter table public.article_products
      add column if not exists position integer not null default 0;
  end if;
end $$;

drop index if exists idx_article_products_article;
create index if not exists idx_article_products_article
  on public.article_products (article_id, position);
