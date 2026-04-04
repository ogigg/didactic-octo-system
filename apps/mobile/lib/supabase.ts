import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { AppState } from "react-native";

function getSupabaseUrl(): string {
  if (__DEV__) {
    const host = Constants.expoConfig?.hostUri?.split(":")[0];
    if (host) return `http://${host}:54321`;
  }
  return process.env.EXPO_PUBLIC_SUPABASE_URL!;
}

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Refresh token when app returns to foreground; pause when backgrounded
AppState.addEventListener("change", (state) => {
  if (state === "active") {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});
