-- User-configurable weight increments used by the progression engine and the
-- LLM prompt. NULL means "auto": fall back to equipment-based defaults.
alter table public.profiles
  add column weight_increment_kg numeric(4, 1),
  add column weight_micro_increment_kg numeric(3, 1);

alter table public.profiles
  add constraint profiles_weight_increment_kg_check
    check (weight_increment_kg is null or weight_increment_kg > 0),
  add constraint profiles_weight_micro_increment_kg_check
    check (weight_micro_increment_kg is null or weight_micro_increment_kg >= 0);
