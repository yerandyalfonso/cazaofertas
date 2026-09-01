-- Condiciones / T&C de cupones (entrada manual o scrape).

alter table public.coupons
  add column if not exists terms text not null default '';

comment on column public.coupons.terms is
  'Condiciones del cupón (caducidad detallada, exclusiones, cómo activar, etc.).';
