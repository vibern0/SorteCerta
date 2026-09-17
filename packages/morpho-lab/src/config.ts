import { getAddress, isHex } from "viem";
import type { Address, Hex } from "viem";

const DEFAULTS = {
  chainId: 11155111,
  rpcUrl: "https://rpc.sepolia.org",
  usdc: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238",
  weth: "0x7b79995e5f793A07Bc00c21412e50Ecae098E7f9",
  wrapper: "0x3B4F71c77e288d92871Cda495891Cd42f543A3f5",
  pool: "0x3d974cEF83CaC5BfD970CA95E121774eb8C9f233",
  adapter: "0x84B120Db8b600DE01A49143cf515246B79afcfef",
  morpho: "0xd011EE229E7459ba1ddd22631eF7bF528d424A14",
  marketId: "0x8c561f0929c3a3e2b20fba99c2ae15fc57b4d0599e4371b67c9a58388a27b9d2",
} as const;

type AddressKey = "usdc" | "weth" | "wrapper" | "pool" | "adapter" | "morpho";

const ADDRESS_ENV: Record<AddressKey, string> = {
  usdc: "VITE_USDC_ADDRESS",
  weth: "VITE_WETH_ADDRESS",
  wrapper: "VITE_WRAPPER_ADDRESS",
  pool: "VITE_POOL_ADDRESS",
  adapter: "VITE_ADAPTER_ADDRESS",
  morpho: "VITE_MORPHO_ADDRESS",
};

const ADDRESS_LABEL: Record<AddressKey, string> = {
  usdc: "USDC address",
  weth: "WETH address",
  wrapper: "Wrapper address",
  pool: "Pool address",
  adapter: "Adapter address",
  morpho: "Morpho address",
};

export type LabConfig = {
  chainId: 11155111;
  rpcUrl: string;
  usdc: Address;
  weth: Address;
  wrapper: Address;
  pool: Address;
  adapter: Address;
  morpho: Address;
  marketId: Hex;
};

export function loadLabConfig(env: Record<string, string | undefined>): LabConfig {
  const config: LabConfig = {
    chainId: 11155111,
    rpcUrl: env.VITE_SEPOLIA_RPC_URL ?? DEFAULTS.rpcUrl,
    usdc: loadAddress("usdc", env),
    weth: loadAddress("weth", env),
    wrapper: loadAddress("wrapper", env),
    pool: loadAddress("pool", env),
    adapter: loadAddress("adapter", env),
    morpho: loadAddress("morpho", env),
    marketId: loadMarketId(env),
  };

  validateLabConfig(config);
  return config;
}

export function validateLabConfig(config: LabConfig): void {
  if (config.chainId !== 11155111) {
    throw new Error("Chain ID must be 11155111");
  }

  if (config.rpcUrl.trim().length === 0) {
    throw new Error("RPC URL is required");
  }

  for (const key of Object.keys(ADDRESS_LABEL) as AddressKey[]) {
    try {
      getAddress(config[key]);
    } catch {
      throw new Error(`${ADDRESS_LABEL[key]} is invalid`);
    }
  }

  if (!isMarketId(config.marketId)) {
    throw new Error("Market ID must be exactly 32 bytes");
  }
}

function loadAddress(key: AddressKey, env: Record<string, string | undefined>): Address {
  const override = env[ADDRESS_ENV[key]];
  const rawAddress = override === undefined ? DEFAULTS[key] : override.toLowerCase();

  try {
    return getAddress(rawAddress);
  } catch {
    throw new Error(`${ADDRESS_LABEL[key]} is invalid`);
  }
}

function loadMarketId(env: Record<string, string | undefined>): Hex {
  const marketId = env.VITE_MORPHO_MARKET_ID ?? DEFAULTS.marketId;

  if (!isMarketId(marketId)) {
    throw new Error("Market ID must be exactly 32 bytes");
  }

  return marketId;
}

function isMarketId(value: string): value is Hex {
  return isHex(value, { strict: true }) && value.length === 66;
}
