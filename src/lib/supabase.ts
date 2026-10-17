import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * OFFMUTE connects to Supabase with exactly two frontend variables:
 *   VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
 * No service-role key, no backend, no third-party API keys.
 */
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? "";
const envKey =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ?? "";

export const isSupabaseConfigured: boolean =
  /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(envUrl.trim()) &&
  envKey.trim().length > 20 &&
  !envUrl.toUpperCase().includes("YOUR_PROJECT") &&
  !envKey.toUpperCase().includes("YOUR_PUBLISHABLE_KEY");

export const supabase: SupabaseClient = createClient(
  isSupabaseConfigured ? envUrl.trim() : "https://placeholder.supabase.co",
  isSupabaseConfigured ? envKey.trim() : "placeholder-publishable-key",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);
