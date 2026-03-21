import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/hooks/use-auth";
import { profileKeys } from "@/lib/query-keys";
import { supabase } from "@/lib/supabase";

export function useProfile() {
  const { user } = useAuth();

  return useQuery({
    queryKey: profileKeys.detail(user?.id ?? ""),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user!.id)
        .single();

      if (error) throw new Error(error.message);
      return data;
    },
    enabled: !!user,
  });
}
