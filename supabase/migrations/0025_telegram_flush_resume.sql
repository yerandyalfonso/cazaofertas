-- Reintento parcial del lote Telegram hasta vaciar la cola.
alter table public.app_settings
  add column if not exists telegram_flush_resume_at timestamptz;
