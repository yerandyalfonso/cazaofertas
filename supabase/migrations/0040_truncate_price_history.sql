-- Liberar espacio: el histórico de precios deja de usarse en producto/crons.
-- La tabla se mantiene vacía por si se reactiva en el futuro.
truncate table public.price_history;
