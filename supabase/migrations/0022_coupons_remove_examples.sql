-- Quita cupones de ejemplo (source=manual) sembrados en 0021.
-- A partir de ahora solo se muestran cupones detectados o añadidos de verdad.

delete from public.coupons
where source = 'manual'
  and code in (
    'PRIME',
    'MODA15',
    'NEWSLETTER',
    'REBAJAS',
    'APP',
    'WELCOME',
    'CLUB'
  );
