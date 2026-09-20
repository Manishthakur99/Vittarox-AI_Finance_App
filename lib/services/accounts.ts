import type { SupabaseClient } from "@supabase/supabase-js";

export type AccountType = "CASH" | "BANK" | "CREDIT_CARD" | "SAVINGS";

export type Account = {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  is_default: boolean;
  created_at: string;
};

export async function getAccounts(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("accounts")
    .select("*")
    .eq("user_id", userId)
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data as Account[];
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  { name, type }: { name: string; type: AccountType },
) {
  const { data, error } = await supabase
    .from("accounts")
    .insert({ user_id: userId, name, type, balance: 0, is_default: false })
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function setDefaultAccount(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
) {
  const { error: unsetError } = await supabase
    .from("accounts")
    .update({ is_default: false })
    .eq("user_id", userId)
    .neq("id", accountId);
  if (unsetError) throw unsetError;

  const { error: setError } = await supabase
    .from("accounts")
    .update({ is_default: true })
    .eq("id", accountId);
  if (setError) throw setError;
}

export async function updateAccount(
  supabase: SupabaseClient,
  accountId: string,
  { name, type }: { name: string; type: AccountType },
) {
  const { data, error } = await supabase
    .from("accounts")
    .update({ name, type })
    .eq("id", accountId)
    .select()
    .single();

  if (error) throw error;
  return data as Account;
}

export async function deleteAccount(
  supabase: SupabaseClient,
  accountId: string,
  { force = false }: { force?: boolean } = {},
) {
  const { count, error: countError } = await supabase
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("account_id", accountId);

  if (countError) throw countError;
  const transactionCount = count ?? 0;

  if (transactionCount > 0 && !force) {
    return { deleted: false, transactionCount };
  }

  const { error: deleteError } = await supabase
    .from("accounts")
    .delete()
    .eq("id", accountId);

  if (deleteError) throw deleteError;
  return { deleted: true, transactionCount };
}
