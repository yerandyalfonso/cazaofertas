-- Align articles with CMS schema if an older 0003 draft was applied

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public' and table_name = 'articles'
  ) then
    -- Rename legacy columns when present
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'articles' and column_name = 'body'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'articles' and column_name = 'content'
    ) then
      alter table public.articles rename column body to content;
    end if;

    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'articles' and column_name = 'cover_image'
    ) and not exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'articles' and column_name = 'featured_image'
    ) then
      alter table public.articles rename column cover_image to featured_image;
    end if;

    alter table public.articles add column if not exists author text not null default 'CazaOferta';
    alter table public.articles add column if not exists status text not null default 'draft';
    alter table public.articles add column if not exists seo_title text;
    alter table public.articles add column if not exists seo_description text;

    -- reading_time: migrate text "8 min" → integer minutes when needed
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public'
        and table_name = 'articles'
        and column_name = 'reading_time'
        and data_type in ('text', 'character varying')
    ) then
      alter table public.articles add column if not exists reading_time_minutes integer;
      update public.articles
      set reading_time_minutes = coalesce(
        nullif(regexp_replace(reading_time, '[^0-9]', '', 'g'), '')::integer,
        5
      );
      alter table public.articles drop column reading_time;
      alter table public.articles rename column reading_time_minutes to reading_time;
      alter table public.articles alter column reading_time set default 5;
      alter table public.articles alter column reading_time set not null;
    end if;

    alter table public.articles add column if not exists reading_time integer not null default 5;

    -- Map legacy publish flags → status
    if exists (
      select 1 from information_schema.columns
      where table_schema = 'public' and table_name = 'articles' and column_name = 'is_published'
    ) then
      update public.articles
      set status = case when is_published then 'published' else 'draft' end
      where status = 'draft' or status is null;
      alter table public.articles drop column if exists is_published;
    end if;

    alter table public.articles drop column if exists cover_alt;
    alter table public.articles drop column if exists is_featured;
    alter table public.articles drop column if exists published_at;

    begin
      alter table public.articles
        add constraint articles_status_check
        check (status in ('draft', 'published', 'archived'));
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

create index if not exists idx_articles_status
  on public.articles (status, updated_at desc);
