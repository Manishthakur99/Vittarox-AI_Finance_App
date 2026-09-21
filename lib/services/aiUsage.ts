import type { SupabaseClient } from "@supabase/supabase-js";

const DAILY_AI_LIMIT = 4;

export async function assertWithinAiLimit(
  supabase: SupabaseClient,
  userId: string,
) {
  const { data: allowed, error } = await supabase.rpc("increment_ai_usage", {
    p_user_id: userId,
    p_limit: DAILY_AI_LIMIT,
  });

  if (error) {
    console.error("AI usage check failed:", error);
    return; // fail-open: check fail ho jaye toh block mat karo
  }

  if (!allowed) {
    throw new Error(
      `You've reached today's limit of ${DAILY_AI_LIMIT} AI requests. Please try again tomorrow.`,
    );
  }
}