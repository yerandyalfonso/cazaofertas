-- Último precio avisado de una alerta de URL: no se vuelve a avisar hasta que
-- baje otro 2 % por debajo (evita avisos repetidos si el precio oscila
-- céntimos). Se borra cuando el precio vuelve a subir ≥5 % (oferta terminada).
alter table public.alerts
  add column if not exists last_notified_price numeric(10, 2);
