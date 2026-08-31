-- Allow Miravia as a price_history source (flash discovery + future rechecks).
alter table public.price_history
  drop constraint if exists price_history_source_check;

alter table public.price_history
  add constraint price_history_source_check
  check (
    source in (
      'seed',
      'mock',
      'amazon',
      'keepa',
      'kiabi',
      'carrefour',
      'miravia'
    )
  );
