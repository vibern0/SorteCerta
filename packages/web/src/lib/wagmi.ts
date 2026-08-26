import { createConfig, http } from "wagmi";
import { sepolia } from "wagmi/chains";
import { CHAIN_ID, RPC_URL } from "./contracts";

// We use Web3Auth only to derive the Safe smart account. wagmi is here for
// read-side ergonomics
// (`useReadContracts`, `useBlockNumber`, etc.) — no wagmi connectors needed.

export const wagmiConfig = createConfig({
  chains: [sepolia],
  connectors: [],
  transports: {
    [sepolia.id]: http(RPC_URL),
  },
  ssr: true,
});

export { CHAIN_ID };
