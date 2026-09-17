import { useSupabase } from "@/hooks/useSupabase";
import {
    deleteTransaction,
    Transaction,
    TransactionType,
} from "@/lib/services/transactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export function useDeleteTransaction() {
  const supabase = useSupabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      tx: Pick<Transaction, "id" | "account_id" | "amount" | "type">,
    ) =>
      deleteTransaction(
        supabase,
        tx.id,
        tx.account_id,
        tx.amount,
        tx.type as TransactionType,
      ),
    onSuccess: (result) => {
      if (result.error) return;
      queryClient.invalidateQueries({ queryKey: ["transactions"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });
}
