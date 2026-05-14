-- -----------------------------------------------------------------------------
-- Migration: restore_polish_diacritics
-- Restores Polish diacritics in catalog labels and curated exercise translations.
-- -----------------------------------------------------------------------------

UPDATE catalog_label_translations AS label
SET display_name = source.display_name
FROM (
  VALUES
    ('muscle', 'Anterior deltoid', 'pl', 'Przedni akton barków'),
    ('muscle', 'Gastrocnemius', 'pl', 'Łydki'),
    ('muscle', 'Gluteus maximus', 'pl', 'Pośladki'),
    ('muscle', 'Hamstrings', 'pl', 'Dwugłowe uda'),
    ('muscle', 'Lateral deltoid', 'pl', 'Boczny akton barków'),
    ('muscle', 'Posterior deltoid', 'pl', 'Tylny akton barków'),
    ('muscle', 'Quadriceps', 'pl', 'Czworogłowe uda'),
    ('muscle', 'Rectus abdominis', 'pl', 'Mięśnie brzucha'),
    ('muscle', 'Rhomboids', 'pl', 'Równoległoboczne'),
    ('muscle', 'Soleus', 'pl', 'Mięsień płaszczkowaty'),
    ('equipment', 'Bench', 'pl', 'Ławka'),
    ('equipment', 'Body weight', 'pl', 'Masa ciała'),
    ('equipment', 'bodyweight', 'pl', 'Masa ciała'),
    ('equipment', 'Cable machine', 'pl', 'Wyciąg'),
    ('equipment', 'Calf raise machine', 'pl', 'Maszyna do wspięć'),
    ('equipment', 'Dip bars', 'pl', 'Poręcze'),
    ('equipment', 'Incline Bench', 'pl', 'Ławka skośna'),
    ('equipment', 'Leg curl machine', 'pl', 'Maszyna do uginania nóg'),
    ('equipment', 'Leg extension machine', 'pl', 'Maszyna do prostowania nóg'),
    ('equipment', 'Pull-up bar', 'pl', 'Drążek'),
    ('equipment', 'Squat rack', 'pl', 'Stojak do przysiadów'),
    ('difficulty', 'beginner', 'pl', 'Początkujący'),
    ('difficulty', 'intermediate', 'pl', 'Średniozaawansowany')
) AS source(label_type, label_key, language_code, display_name)
WHERE label.label_type = source.label_type
  AND label.label_key = source.label_key
  AND label.language_code = source.language_code;

UPDATE exercise_translations AS translation
SET
  name = source.pl_name,
  instructions = source.instructions,
  updated_at = NOW()
FROM exercises AS exercise
JOIN (
  VALUES
    (ARRAY['fallback-1', 'wger-73']::TEXT[], 'Barbell Bench Press', 'Wyciskanie sztangi leżąc', 'Połóż się na płaskiej ławce, chwyć sztangę nieco szerzej niż barki, opuść ją do klatki piersiowej i wyciśnij w górę.'),
    (ARRAY['fallback-2']::TEXT[], 'Incline Dumbbell Press', 'Wyciskanie hantli na ławce skośnej', 'Ustaw ławkę pod kątem 30-45 stopni i wyciskaj hantle w górę z poziomu klatki piersiowej.'),
    (ARRAY['fallback-3']::TEXT[], 'Cable Flyes', 'Rozpiętki na wyciągu', 'Stań pomiędzy wyciągami i z lekko ugiętymi łokciami prowadź uchwyty do siebie przed klatką piersiową.'),
    (ARRAY['fallback-4']::TEXT[], 'Barbell Squat', 'Przysiad ze sztangą', 'Ustaw sztangę na górnej części pleców, zejdź w przysiad z kolanami prowadzonymi na zewnątrz i wstań kontrolowanie.'),
    (ARRAY['fallback-5']::TEXT[], 'Leg Press', 'Wypychanie nóg na suwnicy', 'Usiądź na suwnicy, ustaw stopy na platformie, opuść ciężar kontrolowanie i wypchnij go bez blokowania kolan.'),
    (ARRAY['fallback-6', 'wger-1700']::TEXT[], 'Romanian Deadlift', 'Rumuński martwy ciąg', 'Trzymaj lekko ugięte kolana, cofnij biodra i opuszczaj sztangę wzdłuż ud, czując rozciągnięcie tyłu uda.'),
    (ARRAY['fallback-7']::TEXT[], 'Conventional Deadlift', 'Martwy ciąg klasyczny', 'Ustaw stopy pod sztangą, napnij plecy i brzuch, podnieś sztangę przez wyprost bioder oraz kolan.'),
    (ARRAY['fallback-8']::TEXT[], 'Overhead Press', 'Wyciskanie sztangi nad głowę', 'Trzymaj sztangę na wysokości barków, napnij brzuch i wyciśnij sztangę nad głowę bez odchylania tułowia.'),
    (ARRAY['fallback-9']::TEXT[], 'Lateral Raises', 'Unoszenie hantli bokiem', 'Stojąc prosto unoś hantle bokiem do wysokości barków, prowadź ruch kontrolowanie i nie bujaj tułowiem.'),
    (ARRAY['fallback-10']::TEXT[], 'Pull-ups', 'Podciąganie', 'Zawiśnij na drążku, ściągnij łopatki i podciągnij brodę ponad drążek, po czym opuść się kontrolowanie.'),
    (ARRAY['fallback-11', 'wger-1698', 'wger-1699']::TEXT[], 'Barbell Row', 'Wiosłowanie sztangą', 'Pochyl tułów, trzymaj plecy prosto i przyciągaj sztangę do dolnej części brzucha.'),
    (ARRAY['fallback-12', 'wger-1510']::TEXT[], 'Lat Pulldown', 'Ściąganie drążka wyciągu', 'Usiądź pod wyciągiem, ściągnij drążek do górnej części klatki i kontrolowanie wróć do wyprostu ramion.'),
    (ARRAY['fallback-13']::TEXT[], 'Seated Cable Row', 'Wiosłowanie na wyciągu siedząc', 'Usiądź prosto, przyciągnij uchwyt do tułowia i ściągnij łopatki, po czym powoli wyprostuj ramiona.'),
    (ARRAY['fallback-14']::TEXT[], 'Barbell Curl', 'Uginanie ramion ze sztangą', 'Trzymaj łokcie blisko tułowia i uginaj ramiona ze sztangą bez bujania ciałem.'),
    (ARRAY['fallback-15', 'wger-1567']::TEXT[], 'Hammer Curl', 'Uginanie młotkowe', 'Trzymaj hantle neutralnym chwytem i uginaj ramiona, utrzymując łokcie blisko tułowia.'),
    (ARRAY['fallback-16', 'wger-805', 'wger-1185']::TEXT[], 'Tricep Pushdown', 'Prostowanie ramion na wyciągu', 'Stojąc przy wyciągu trzymaj łokcie blisko tułowia i prostuj ramiona w dół, mocno dopinając triceps.'),
    (ARRAY['fallback-17']::TEXT[], 'Overhead Tricep Extension', 'Prostowanie tricepsa nad głową', 'Trzymaj obciążenie nad głową, zegnij łokcie za głowę i wyprostuj ramiona, utrzymując łokcie stabilnie.'),
    (ARRAY['fallback-18']::TEXT[], 'Dips', 'Dipy na poręczach', 'Oprzyj się na poręczach, opuść ciało z kontrolą i wyprostuj ramiona, utrzymując barki stabilnie.'),
    (ARRAY['fallback-19']::TEXT[], 'Leg Curl', 'Uginanie nóg leżąc', 'Leżąc na maszynie uginaj kolana, przyciągając poduszkę w stronę pośladków bez odrywania bioder.'),
    (ARRAY['fallback-20']::TEXT[], 'Leg Extension', 'Prostowanie nóg na maszynie', 'Usiądź na maszynie, wyprostuj kolana kontrolowanym ruchem i powoli wróć do pozycji startowej.'),
    (ARRAY['fallback-21']::TEXT[], 'Calf Raise', 'Wspięcia na palce', 'Stań stabilnie, unieś pięty jak najwyżej, zatrzymaj ruch na górze i powoli opuść pięty.'),
    (ARRAY['fallback-22']::TEXT[], 'Plank', 'Deska', 'Oprzyj się na przedramionach lub dłoniach. Utrzymaj ciało w prostej linii od głowy do pięt, napnij brzuch i pośladki, oddychaj spokojnie.'),
    (ARRAY['fallback-23']::TEXT[], 'Cable Crunch', 'Brzuszki na wyciągu klęcząc', 'Klęknij przy wyciągu, trzymaj linę przy głowie i zginaj tułów, prowadząc żebra w stronę bioder.'),
    (ARRAY['fallback-24']::TEXT[], 'Face Pull', 'Face Pull', 'Ustaw linę na wysokości twarzy, przyciągaj ją do czoła i prowadź łokcie szeroko, ściskając tył barków.'),
    (ARRAY['fallback-25', 'wger-1706']::TEXT[], 'Bulgarian Split Squat', 'Przysiad bułgarski', 'Oprzyj tylną stopę na ławce, zejdź w dół kontrolowanie i wróć do pozycji stojącej, utrzymując stabilne kolano.'),
    (ARRAY['fallback-26', 'wger-567']::TEXT[], 'Dumbbell Shoulder Press', 'Wyciskanie hantli nad głowę', 'Trzymaj hantle na wysokości barków, napnij brzuch i wyciśnij je nad głowę bez bujania tułowiem.'),
    (ARRAY['fallback-27']::TEXT[], 'Chest Dip', 'Dipy na klatkę', 'Oprzyj się na poręczach, pochyl lekko tułów do przodu, opuść ciało i wypchnij się w górę.'),
    (ARRAY['fallback-28']::TEXT[], 'Hip Thrust', 'Hip Thrust ze sztangą', 'Oprzyj górną część pleców o ławkę, ustaw sztangę na biodrach i wypchnij biodra w górę, dopinając pośladki.'),
    (ARRAY['fallback-29']::TEXT[], 'Incline Barbell Press', 'Wyciskanie sztangi na ławce skośnej', 'Ustaw ławkę pod skosem, opuść sztangę do górnej części klatki i wyciśnij ją w górę kontrolowanym ruchem.'),
    (ARRAY['fallback-30']::TEXT[], 'Push-ups', 'Pompki', 'Ustaw ciało w linii prostej, opuść klatkę w stronę podłogi i wypchnij się w górę bez zapadania bioder.'),
    (ARRAY[]::TEXT[], 'Side Plank', 'Deska bokiem', 'Połóż się na boku i oprzyj na przedramieniu. Unieś biodra, utrzymując prostą linię ciała, a potem wykonaj drugą stronę.'),
    (ARRAY[]::TEXT[], 'Wall Sit', 'Krzesełko przy ścianie', 'Oprzyj plecy o ścianę i zejdź do pozycji, w której uda są równoległe do podłogi. Utrzymaj pozycję przez zadany czas.'),
    (ARRAY[]::TEXT[], 'Dead Hang', 'Martwy zwis', 'Chwyć drążek obiema rękami i zawiśnij z wyprostowanymi ramionami. Delikatnie ściągnij łopatki i utrzymaj pozycję.'),
    (ARRAY[]::TEXT[], 'L-Sit Hold', 'Trzymanie L-sit', 'Usiądź z wyprostowanymi nogami, oprzyj ręce obok bioder i unieś ciało oraz nogi, utrzymując kształt litery L.')
) AS source(external_ids, name, pl_name, instructions)
  ON exercise.external_id = ANY(source.external_ids)
  OR exercise.name = source.name
WHERE translation.exercise_id = exercise.id
  AND translation.language_code = 'pl';
