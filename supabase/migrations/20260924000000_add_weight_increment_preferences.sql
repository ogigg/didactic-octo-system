-- Per-equipment weight increments used by the progression engine and the LLM
-- prompt. JSONB keyed by equipment category ("barbell" | "dumbbell" |
-- "machine" | "cable"), each value shaped { "base_kg": number|null,
-- "micro_kg": number|null }. NULL column or NULL fields mean "auto":
-- fall back to equipment-based defaults.
alter table public.profiles
  add column weight_increments jsonb;

alter table public.profiles
  add constraint profiles_weight_increments_check
    check (weight_increments is null or jsonb_typeof(weight_increments) = 'object');
