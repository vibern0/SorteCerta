import type { Hash, PublicClient } from "viem";

export async function waitForActionReceipt(
  client: Pick<PublicClient, "waitForTransactionReceipt">,
  hash: Hash,
  onRepriced: (hash: Hash) => void
) {
  let replacementError: Error | undefined;
  const receipt = await client.waitForTransactionReceipt({
    hash,
    onReplaced({ reason, replacedTransaction, transaction }) {
      if (
        reason !== "repriced" ||
        transaction.to?.toLowerCase() !==
          replacedTransaction.to?.toLowerCase() ||
        transaction.input !== replacedTransaction.input ||
        transaction.value !== replacedTransaction.value
      ) {
        replacementError = new Error(
          reason === "cancelled"
            ? "Transaction cancelled in wallet. Action stopped."
            : "Transaction replaced with a different action. Action stopped."
        );
        return;
      }
      if (!replacementError) onRepriced(transaction.hash);
    },
  });
  if (replacementError) throw replacementError;
  if (receipt.status !== "success")
    throw new Error("Transaction reverted onchain.");
  return receipt;
}
