jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    from: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";
import { fetchExercise, fetchExercises } from "../exercises";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const validExercise = {
  id: "550e8400-e29b-41d4-a716-446655440001",
  name: "Bench Press",
  external_id: "ext-1",
  primary_muscles: ["chest"],
  secondary_muscles: ["triceps"],
  equipment: ["barbell", "bench"],
  difficulty_level: "intermediate",
  instructions: "Press the bar up",
  image_url: "https://example.com/bench.gif",
  video_url: null,
};

function mockSelectChain(data: unknown, error: unknown = null) {
  return {
    select: jest.fn().mockReturnValue({
      order: jest.fn().mockResolvedValue({ data, error }),
      eq: jest.fn().mockReturnValue({
        single: jest.fn().mockResolvedValue({ data, error }),
      }),
      overlaps: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis(),
    }),
  };
}

describe("fetchExercises", () => {
  it("returns validated exercises from supabase", async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      mockSelectChain([validExercise])
    );

    const result = await fetchExercises();

    expect(mockSupabase.from).toHaveBeenCalledWith("exercises");
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Bench Press");
  });

  it("throws when supabase returns an error", async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      mockSelectChain(null, { message: "connection error" })
    );

    await expect(fetchExercises()).rejects.toThrow("connection error");
  });

  it("throws when data fails Zod validation", async () => {
    const invalidExercise = { ...validExercise, primary_muscles: "not-array" };
    (mockSupabase.from as jest.Mock).mockReturnValue(
      mockSelectChain([invalidExercise])
    );

    await expect(fetchExercises()).rejects.toThrow();
  });
});

describe("fetchExercise", () => {
  it("returns a single validated exercise", async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      mockSelectChain(validExercise)
    );

    const result = await fetchExercise(validExercise.id);

    expect(result.id).toBe(validExercise.id);
    expect(result.name).toBe("Bench Press");
  });

  it("throws when supabase returns an error", async () => {
    (mockSupabase.from as jest.Mock).mockReturnValue(
      mockSelectChain(null, { message: "not found" })
    );

    await expect(fetchExercise("bad-id")).rejects.toThrow("not found");
  });
});
