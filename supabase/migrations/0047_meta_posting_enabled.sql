-- Interruptor para publicar en Facebook/Instagram (Meta). Arranca apagado:
-- la página está bloqueada por Meta (código 368) y, si se publica durante el
-- bloqueo, el lote se pierde. Se vuelve a apagar solo si Meta bloquea otra vez.

alter table public.app_settings
  add column if not exists meta_posting_enabled boolean not null default false;

comment on column public.app_settings.meta_posting_enabled is
  'Si es false no se publica en Facebook/Instagram (la cola sigue llenándose). Se desactiva solo ante un bloqueo de Meta (368).';
