-- Comentarios en artículos del blog (lectores + respuestas admin).

create table if not exists public.article_comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  parent_id uuid references public.article_comments (id) on delete cascade,
  author_name text not null,
  author_email text,
  body text not null,
  admin_reply text,
  admin_replied_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'hidden')),
  notify_on_reply boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists article_comments_article_id_idx
  on public.article_comments (article_id);

create index if not exists article_comments_status_created_idx
  on public.article_comments (status, created_at desc);

comment on table public.article_comments is 'Comentarios de lectores en artículos del blog';
comment on column public.article_comments.notify_on_reply is 'Si true y hay email, avisar al lector cuando el admin responda';
