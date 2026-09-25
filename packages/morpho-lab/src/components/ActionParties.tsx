import type { Address } from "viem";

export function ActionParties({
  account,
  destination,
}: {
  account: Address;
  destination: Address;
}) {
  return (
    <>
      <p>
        Account: <span className="action-address">{account}</span>
      </p>
      <p>
        Destination: <span className="action-address">{destination}</span>
      </p>
    </>
  );
}
