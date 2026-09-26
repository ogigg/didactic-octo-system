-- Polish labels for the primary muscles added with the curated catalog
-- (20260615000000). Without them `localized_label_array` falls back to the
-- English label, so Polish users saw e.g. "Trapezius" in the exercise picker
-- and on workout exercise cards.

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
VALUES
  ('muscle', 'Adductors', 'pl', 'Przywodziciele', 'curated'),
  ('muscle', 'Forearms', 'pl', 'Przedramiona', 'curated'),
  ('muscle', 'Gluteus medius', 'pl', 'Pośladek średni', 'curated'),
  ('muscle', 'Obliques', 'pl', 'Skośne brzucha', 'curated'),
  ('muscle', 'Trapezius', 'pl', 'Czworoboczny grzbietu', 'curated')
-- Insert-only: rows that already exist are left untouched.
ON CONFLICT (label_type, label_key, language_code) DO NOTHING;
