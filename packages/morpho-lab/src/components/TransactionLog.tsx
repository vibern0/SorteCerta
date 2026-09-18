import { useMetaMask } from "../wallet/MetaMaskProvider";

export function TransactionLog() {
  const { transactions } = useMetaMask();

  return (
    <section aria-labelledby="activity-title">
      <h2 id="activity-title">Activity</h2>
      {transactions.length === 0 ? <p>No transactions submitted.</p> : null}
      <ol>
        {transactions.map((transaction) => (
          <li key={transaction.id}>
            <strong>{transaction.summary}</strong>
            <span> {transaction.status}</span>
            {transaction.blockNumber === undefined ? null : (
              <span> in block {transaction.blockNumber.toString()}</span>
            )}
            {transaction.error === undefined ? null : <p role="alert">{transaction.error}</p>}
            {transaction.hash === undefined ? null : (
              <p>
                <a
                  href={`https://sepolia.blockscout.com/tx/${transaction.hash}`}
                  rel="noreferrer"
                  target="_blank"
                >
                  View transaction on Blockscout
                </a>
              </p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
