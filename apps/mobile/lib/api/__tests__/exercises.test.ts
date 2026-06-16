jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import {
  fetchCatalogLabels,
  fetchExercise,
  fetchExerciseFilterOptions,
  fetchExercises,
} from "../exercises";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const validExercise = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Bench Press",
  external_id: "ext-1",
  exercise_type: "weight",
  primary_muscles: ["chest"],
  primary_muscle_labels: ["Chest"],
  secondary_muscles: ["triceps"],
  secondary_muscle_labels: ["Triceps"],
  equipment: ["barbell", "bench"],
  equipment_labels: ["Barbell", "Bench"],
  difficulty_level: "intermediate",
  difficulty_label: "Intermediate",
  instructions: "Press the bar up",
  image: {
    url: "https://example.com/bench-hero.png",
    thumbnail_url: "https://example.com/bench-thumb.png",
    width: 1254,
    height: 1254,
    thumbnail_width: 192,
    thumbnail_height: 192,
    alt_text: "Bench press illustration",
    blurhash: null,
    source: "curated",
  },
  image_url: "https://example.com/bench.gif",
  video_url: null,
};

function mockRpc(data: unknown, error: unknown = null) {
  (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data, error });
}

describe("fetchExercises", () => {
  it("returns validated exercises from supabase", async () => {
    mockRpc([validExercise]);

    const result = await fetchExercises();

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_localized_exercises", {
      p_language: "en",
      p_search: null,
      p_muscles: null,
      p_equipment: null,
      p_ids: null,
    });
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bench Press");
    expect(result[0].image?.thumbnail_url).toBe(
      "https://example.com/bench-thumb.png"
    );
  });

  it("allows exercises without media", async () => {
    mockRpc([{ ...validExercise, image: null, image_url: null }]);

    const result = await fetchExercises();

    expect(result[0].image).toBeNull();
  });

  it("passes language and filters to the localized exercise RPC", async () => {
    mockRpc([validExercise]);

    await fetchExercises(
      {
        search: "klatka",
        muscles: ["chest"],
        equipment: ["barbell"],
        ids: [validExercise.id],
      },
      "pl"
    );

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_localized_exercises", {
      p_language: "pl",
      p_search: "klatka",
      p_muscles: ["chest"],
      p_equipment: ["barbell"],
      p_ids: [validExercise.id],
    });
  });

  it("trims search filters before calling the localized exercise RPC", async () => {
    mockRpc([validExercise]);

    await fetchExercises({ search: "  bench  " });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_localized_exercises", {
      p_language: "en",
      p_search: "bench",
      p_muscles: null,
      p_equipment: null,
      p_ids: null,
    });
  });

  it("passes blank search filters as null", async () => {
    mockRpc([validExercise]);

    await fetchExercises({ search: "   " });

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_localized_exercises", {
      p_language: "en",
      p_search: null,
      p_muscles: null,
      p_equipment: null,
      p_ids: null,
    });
  });

  it("throws when supabase returns an error", async () => {
    mockRpc(null, { message: "connection error" });

    await expect(fetchExercises()).rejects.toThrow("connection error");
  });

  it("throws when data fails Zod validation", async () => {
    const invalidExercise = { ...validExercise, primary_muscles: "not-array" };
    mockRpc([invalidExercise]);

    await expect(fetchExercises()).rejects.toThrow();
  });
});

describe("fetchExercise", () => {
  it("returns a single validated exercise", async () => {
    mockRpc(validExercise);

    const result = await fetchExercise(validExercise.id, "pl");

    expect(mockSupabase.rpc).toHaveBeenCalledWith("get_localized_exercise", {
      p_exercise_id: validExercise.id,
      p_language: "pl",
    });
    expect(result.id).toBe(validExercise.id);
    expect(result.name).toBe("Bench Press");
  });

  it("throws when supabase returns an error", async () => {
    mockRpc(null, { message: "not found" });

    await expect(fetchExercise("bad-id")).rejects.toThrow("not found");
  });

  it("throws a clear error when the exercise no longer exists", async () => {
    mockRpc({});

    await expect(fetchExercise(validExercise.id)).rejects.toThrow(
      "Exercise not found"
    );
  });
});

describe("fetchCatalogLabels", () => {
  it("returns validated catalog labels", async () => {
    mockRpc([
      {
        label_type: "muscle",
        label_key: "Pectoralis major",
        display_name: "Klatka piersiowa",
      },
    ]);

    const result = await fetchCatalogLabels("pl");

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_localized_catalog_labels",
      {
        p_language: "pl",
      }
    );
    expect(result[0].display_name).toBe("Klatka piersiowa");
  });
});

describe("fetchExerciseFilterOptions", () => {
  it("returns active filter options from the localized filter options RPC", async () => {
    mockRpc([
      {
        label_type: "equipment",
        label_key: "Barbell",
        display_name: "Sztanga",
      },
      {
        label_type: "muscle",
        label_key: "Pectoralis major",
        display_name: "Klatka piersiowa",
      },
    ]);

    const result = await fetchExerciseFilterOptions("pl");

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_localized_exercise_filter_options",
      {
        p_language: "pl",
      }
    );
    expect(result).toHaveLength(2);
  });
});
