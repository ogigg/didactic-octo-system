-- Add weight_unit preference to profiles
-- Values: 'kg' (metric, default) or 'lbs' (imperial)
-- All data remains stored in metric (kg/cm); this column controls display only.

alter table public.profiles
  add column weight_unit text not null default 'kg'
  constraint weight_unit_check check (weight_unit in ('kg', 'lbs'));
