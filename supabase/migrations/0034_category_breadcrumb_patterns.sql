-- Patrones de breadcrumbs (regex source) por subcategoría, editables en admin.

alter table public.category_keywords
  add column if not exists breadcrumb_patterns text[] not null default '{}';

alter table public.category_keywords
  drop constraint if exists category_keywords_keywords_nonempty;

alter table public.category_keywords
  drop constraint if exists category_keywords_groups_nonempty;

alter table public.category_keywords
  drop constraint if exists category_keywords_content_nonempty;

alter table public.category_keywords
  add constraint category_keywords_content_nonempty
  check (
    cardinality(keywords) > 0
    or cardinality(breadcrumb_patterns) > 0
  );

comment on column public.category_keywords.breadcrumb_patterns is
  'Fuentes regex (sin /…/) que se evalúan sobre las migas de Amazon; +6 por match.';
