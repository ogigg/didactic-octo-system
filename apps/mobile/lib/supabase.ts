import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState } from "react-native";

function isLocalSupabaseUrl(value: string): boolean {
  try {
    const { hostname } = new URL(value);
    return hostname === "localhost" || hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

function getSupabaseUrl(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (!value) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_URL.");
  }
  if (!__DEV__ && isLocalSupabaseUrl(value)) {
    throw new Error("Production builds must use a hosted Supabase URL.");
  }
  if (!__DEV__ && !value.startsWith("https://")) {
    throw new Error("Production Supabase URL must use HTTPS.");
  }
  return value;
}

function getSupabaseAnonKey(): string {
  const value = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  if (!value) {
    throw new Error("Missing EXPO_PUBLIC_SUPABASE_ANON_KEY.");
  }
  return value;
}

const supabaseUrl = getSupabaseUrl();
const supabaseAnonKey = getSupabaseAnonKey();

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
