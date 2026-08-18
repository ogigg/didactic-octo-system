jest.mock("@/lib/supabase", () => ({
  supabase: {
    auth: {
      getUser: jest.fn(),
    },
    rpc: jest.fn(),
  },
}));

import { supabase } from "@/lib/supabase";

import { fetchStatsPersonalRecords } from "../stats";

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

const baseRecord = {
  exercise_id: "550e8400-e29b-41d4-a716-446655440001",
  exercise_name: "Bench Press",
  max_weight_kg: 100,
  max_reps: 12,
  max_volume_set_kg: 960,
  est_1rm_kg: 116.7,
};

function mockAuthenticatedRpc(data: unknown): void {
  (mockSupabase.auth.getUser as jest.Mock).mockResolvedValue({
    data: { user: { id: "user-123" } },
    error: null,
  });
  (mockSupabase.rpc as jest.Mock).mockResolvedValue({ data, error: null });
}

describe("fetchStatsPersonalRecords", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("parses paired max weight and reps context from the RPC", async () => {
    mockAuthenticatedRpc([
      {
        ...baseRecord,
        max_weight_reps: 5,
        max_reps_weight_kg: 80,
      },
    ]);

    const records = await fetchStatsPersonalRecords();

    expect(mockSupabase.rpc).toHaveBeenCalledWith(
      "get_stats_personal_records",
      {}
    );
    expect(records[0]).toMatchObject({
      max_weight_reps: 5,
      max_reps_weight_kg: 80,
    });
  });

  it("normalizes missing paired fields from a legacy RPC payload to null", async () => {
    mockAuthenticatedRpc([baseRecord]);

    const records = await fetchStatsPersonalRecords();

    expect(records[0]).toMatchObject({
      max_weight_reps: null,
      max_reps_weight_kg: null,
    });
  });
});
