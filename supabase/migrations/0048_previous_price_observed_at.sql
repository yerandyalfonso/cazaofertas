-- Precio anterior justificable: fecha en que NOSOTROS vimos ese precio (bajada
-- entre dos revisiones). Caduca a los 30 días. Si la referencia es el precio
-- tachado que muestra la tienda en la revisión actual, queda en null y deja de
-- usarse en cuanto la tienda lo quite (antes se arrastraba para siempre y
-- mostraba «antes» que nunca existieron).
alter table public.products
  add column if not exists previous_price_observed_at timestamptz;
