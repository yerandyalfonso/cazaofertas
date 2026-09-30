-- Ajustes de los jobs de ofertas de las tiendas nuevas (Carrefour, MediaMarkt…)
-- editables desde admin → Ajustes. Un objeto por tienda:
--   {"carrefour": {"enabled": true, "minDiscountPercent": 15, ...}, ...}
-- Lo que falte se toma del .env.local de la máquina que corre el job.
alter table public.app_settings
  add column if not exists retailer_deal_settings jsonb not null default '{}'::jsonb;
