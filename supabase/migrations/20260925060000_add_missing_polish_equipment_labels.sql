-- Polish labels for the equipment added with the curated catalog
-- (20260615000000). Without them `localized_label_array` and
-- `get_localized_catalog_labels` fall back to the English label, so Polish
-- users saw English equipment names in the exercise picker filters and on
-- exercise details.

INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name, source)
VALUES
  ('equipment', 'Ab wheel', 'pl', 'Kółko do brzucha', 'curated'),
  ('equipment', 'Assisted pull-up machine', 'pl', 'Maszyna do podciągania ze wspomaganiem', 'curated'),
  ('equipment', 'Back extension bench', 'pl', 'Ławka rzymska', 'curated'),
  ('equipment', 'Box', 'pl', 'Skrzynia', 'curated'),
  ('equipment', 'Chest press machine', 'pl', 'Maszyna do wyciskania na klatkę', 'curated'),
  ('equipment', 'Decline bench', 'pl', 'Ławka skośna ujemna', 'curated'),
  ('equipment', 'EZ-bar', 'pl', 'Gryf łamany', 'curated'),
  ('equipment', 'Glute kickback machine', 'pl', 'Maszyna do wykopów w tył', 'curated'),
  ('equipment', 'Hack squat machine', 'pl', 'Maszyna do przysiadów Hackenschmidta', 'curated'),
  ('equipment', 'Hip abduction machine', 'pl', 'Maszyna do odwodzenia nóg', 'curated'),
  ('equipment', 'Hip adduction machine', 'pl', 'Maszyna do przywodzenia nóg', 'curated'),
  ('equipment', 'Incline bench', 'pl', 'Ławka skośna', 'curated'),
  ('equipment', 'Kettlebell', 'pl', 'Odważnik kulowy', 'curated'),
  ('equipment', 'Lying leg curl machine', 'pl', 'Maszyna do uginania nóg leżąc', 'curated'),
  ('equipment', 'Mat', 'pl', 'Mata', 'curated'),
  ('equipment', 'Medicine ball', 'pl', 'Piłka lekarska', 'curated'),
  ('equipment', 'Pec deck machine', 'pl', 'Maszyna butterfly', 'curated'),
  ('equipment', 'Preacher bench', 'pl', 'Modlitewnik', 'curated'),
  ('equipment', 'Resistance band', 'pl', 'Guma oporowa', 'curated'),
  ('equipment', 'Reverse fly machine', 'pl', 'Maszyna do odwrotnych rozpiętek', 'curated'),
  ('equipment', 'Rope attachment', 'pl', 'Lina do wyciągu', 'curated'),
  ('equipment', 'Row machine', 'pl', 'Maszyna do wiosłowania', 'curated'),
  ('equipment', 'Seated calf raise machine', 'pl', 'Maszyna do wspięć siedząc', 'curated'),
  ('equipment', 'Seated leg curl machine', 'pl', 'Maszyna do uginania nóg siedząc', 'curated'),
  ('equipment', 'Shoulder press machine', 'pl', 'Maszyna do wyciskania nad głowę', 'curated'),
  ('equipment', 'Smith machine', 'pl', 'Maszyna Smitha', 'curated'),
  ('equipment', 'T-bar or landmine', 'pl', 'T-sztanga', 'curated'),
  ('equipment', 'Triceps machine', 'pl', 'Maszyna do tricepsa', 'curated'),
  ('equipment', 'Weight plate', 'pl', 'Talerz obciążeniowy', 'curated')
-- Insert-only: rows that already exist are left untouched.
ON CONFLICT (label_type, label_key, language_code) DO NOTHING;
