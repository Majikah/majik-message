import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const createSupabaseBrowserClient = (): SupabaseClient<
  any,
  any,
  "majikah",
  any,
  any
> => {
  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
  const SUPABASE_PUBLISHABLE_KEY = import.meta.env
    .VITE_SUPABASE_PUBLISHABLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    throw new Error("Supabase environment variables are missing");
  }

  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    db: {
      schema: "majikah",
    },
    global: {
      headers: {
        "X-API-KEY": import.meta.env.VITE_API_KEY, // optional extra API key
      },
    },
  });
};
