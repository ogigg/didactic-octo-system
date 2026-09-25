import {
  hasCatalogLabel,
  parseMigrationCatalog,
} from "./catalog-migration-labels";

function parse(sql: string) {
  return parseMigrationCatalog([sql], ["pl"]);
}

describe("parseMigrationCatalog", () => {
  it("reads label rows in any column order and with casts", () => {
    const catalog = parse(`
      INSERT INTO catalog_label_translations (label_key, label_type, language_code, display_name)
      VALUES ('Mat', 'equipment', 'pl'::text, 'Mata'), ('Box', 'equipment', 'pl', 'Skrzynia')
      ON CONFLICT DO NOTHING;
    `);

    expect(hasCatalogLabel(catalog, "equipment", "Mat", "pl")).toBe(true);
    expect(hasCatalogLabel(catalog, "equipment", "Box", "pl")).toBe(true);
  });

  it("ignores rows that are commented out", () => {
    const catalog = parse(`
      INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name)
      VALUES
        -- ('equipment', 'Mat', 'pl', 'Mata'),
        /* ('equipment', 'Box', 'pl', 'Skrzynia'), */
        ('equipment', 'Bench', 'pl', 'Ławka');
    `);

    expect(hasCatalogLabel(catalog, "equipment", "Mat", "pl")).toBe(false);
    expect(hasCatalogLabel(catalog, "equipment", "Box", "pl")).toBe(false);
    expect(hasCatalogLabel(catalog, "equipment", "Bench", "pl")).toBe(true);
  });

  it("unescapes doubled apostrophes in keys", () => {
    const catalog = parse(`
      INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name)
      VALUES ('equipment', 'Farmer''s walk handles', 'pl', 'Uchwyty do spaceru farmera');
    `);

    expect(
      hasCatalogLabel(catalog, "equipment", "Farmer's walk handles", "pl")
    ).toBe(true);
  });

  it.each([
    "DELETE FROM catalog_label_translations WHERE label_key = 'Box'",
    "TRUNCATE catalog_label_translations",
    "TRUNCATE TABLE public.catalog_label_translations",
    "UPDATE catalog_label_translations SET label_key = 'Plyo box' WHERE label_key = 'Box'",
    "DO $$ BEGIN DELETE FROM catalog_label_translations; END $$",
  ])("fails loudly on statements it can't follow: %s", (sql) => {
    expect(() => parse(sql)).toThrow();
  });

  it("allows updating display names only", () => {
    expect(() =>
      parse(`
        UPDATE catalog_label_translations AS label
        SET display_name = source.display_name
        FROM (VALUES ('equipment', 'Bench', 'pl', 'Ławka'))
          AS source(label_type, label_key, language_code, display_name)
        WHERE label.label_key = source.label_key
      `)
    ).not.toThrow();
  });

  it("fails on translated labels inserted with SELECT but allows the canonical ones", () => {
    expect(() =>
      parse(`
        INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name)
        SELECT 'equipment', key, 'pl', key FROM keys
      `)
    ).toThrow();
    expect(() =>
      parse(`
        INSERT INTO catalog_label_translations (label_type, label_key, language_code, display_name)
        SELECT DISTINCT 'muscle', muscle, 'en', muscle FROM exercises
      `)
    ).not.toThrow();
  });

  it("reads exercise keys from VALUES, including DO blocks, but not function bodies", () => {
    const catalog = parse(`
      INSERT INTO exercises (name, primary_muscles, secondary_muscles, equipment)
      VALUES ('Crunch', ARRAY['Rectus abdominis'], NULL, '{"Mat"}');
      DO $$ BEGIN
        INSERT INTO exercises (name, primary_muscles, equipment)
        VALUES ('Swing', ARRAY['Gluteus maximus'], ARRAY['Kettlebell']);
      END $$;
      CREATE FUNCTION seed() RETURNS void LANGUAGE sql AS $$
        INSERT INTO exercises (name, primary_muscles, equipment)
        VALUES ('Ghost', ARRAY['Neck'], ARRAY['Harness']);
      $$;
    `);

    expect([...catalog.exerciseKeys.muscle].sort()).toEqual([
      "Gluteus maximus",
      "Rectus abdominis",
    ]);
    expect([...catalog.exerciseKeys.equipment].sort()).toEqual([
      "Kettlebell",
      "Mat",
    ]);
  });
});
