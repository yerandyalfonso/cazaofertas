-- Proyectos de diseño del admin (tarjetas, carruseles y vídeos de Redes).
-- Antes vivían solo en localStorage y se perdían al cambiar de equipo o
-- borrar el navegador. El id es el que genera el cliente (p. ej.
-- "social-<ts>-<rand>") porque los vídeos referencian tarjetas por ese id.

create table if not exists design_projects (
  id text primary key,
  kind text not null,
  name text not null,
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint design_projects_kind_check
    check (kind in ('card', 'carousel', 'video'))
);

create index if not exists idx_design_projects_kind_updated
  on design_projects (kind, updated_at desc);

-- Sin políticas: solo accesible con la service key (API del admin).
alter table design_projects enable row level security;
