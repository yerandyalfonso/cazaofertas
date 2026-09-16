-- Una fila por subcategoría: lista de keywords (text[]).
-- Migra el modelo anterior (1 fila = 1 keyword) si aún existe.

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
begin
  -- Caso A: tabla antigua con columna "keyword" → agrupar por category_id
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'category_keywords'
      and column_name = 'keyword'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'category_keywords'
      and column_name = 'keywords'
  ) then
    create table public.category_keywords_groups (
      id uuid primary key default gen_random_uuid(),
      category_id uuid not null unique references public.categories (id) on delete cascade,
      keywords text[] not null,
      is_active boolean not null default true,
      notes text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint category_keywords_groups_nonempty check (cardinality(keywords) > 0)
    );

    insert into public.category_keywords_groups (
      category_id,
      keywords,
      is_active,
      notes,
      created_at,
      updated_at
    )
    select
      src.category_id,
      src.keywords,
      src.is_active,
      src.notes,
      src.created_at,
      src.updated_at
    from (
      select
        category_id,
        array(
          select distinct lower(trim(k.keyword))
          from public.category_keywords k
          where k.category_id = ck.category_id
            and length(trim(k.keyword)) > 0
          order by 1
        ) as keywords,
        bool_or(is_active) as is_active,
        nullif(
          string_agg(distinct nullif(trim(notes), ''), ' · '),
          ''
        ) as notes,
        min(created_at) as created_at,
        max(updated_at) as updated_at
      from public.category_keywords ck
      group by category_id
    ) src
    where cardinality(src.keywords) > 0;

    drop table public.category_keywords;
    alter table public.category_keywords_groups rename to category_keywords;
  end if;
end $$;

-- Caso B: aún no existe la tabla (o se renombró) → crear modelo nuevo
create table if not exists public.category_keywords (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null unique references public.categories (id) on delete cascade,
  keywords text[] not null,
  is_active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint category_keywords_keywords_nonempty check (cardinality(keywords) > 0)
);

-- Si quedó la tabla vieja sin migrar por algún edge-case, no tocamos más.

create index if not exists category_keywords_active_idx
  on public.category_keywords (is_active);

create index if not exists category_keywords_keywords_gin_idx
  on public.category_keywords using gin (keywords);

comment on table public.category_keywords is
  'Grupo de palabras clave por subcategoría (editables desde admin). Separadas en array; en UI se editan con comas.';

drop trigger if exists category_keywords_set_updated_at on public.category_keywords;
create trigger category_keywords_set_updated_at
  before update on public.category_keywords
  for each row
  execute function public.set_updated_at();

alter table public.category_keywords enable row level security;

drop policy if exists "Public can read active category keywords" on public.category_keywords;
create policy "Public can read active category keywords"
  on public.category_keywords
  for select
  to anon, authenticated
  using (is_active = true);
