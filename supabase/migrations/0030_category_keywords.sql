-- Keywords de clasificación → una fila por subcategoría (lista de keywords).

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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

create index if not exists category_keywords_active_idx
  on public.category_keywords (is_active);

create index if not exists category_keywords_keywords_gin_idx
  on public.category_keywords using gin (keywords);

comment on table public.category_keywords is
  'Grupo de palabras clave por subcategoría. En admin se editan separadas por comas.';

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
