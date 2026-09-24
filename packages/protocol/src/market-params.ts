import {
  MarketParams,
  type IMarketParams,
} from "@morpho-org/blue-sdk";
import { getAddress, type Address } from "viem";

import { asBigInt, tupleValues } from "./decoders.ts";

const MARKET_PARAM_NAMES = [
  "loanToken",
  "collateralToken",
  "oracle",
  "irm",
  "lltv",
] as const;

export function toMarketParams(params: IMarketParams): MarketParams {
  return new MarketParams({
    loanToken: getAddress(params.loanToken as Address),
    collateralToken: getAddress(params.collateralToken as Address),
    oracle: getAddress(params.oracle as Address),
    irm: getAddress(params.irm as Address),
    lltv: asBigInt(params.lltv, "market LLTV"),
  });
}

export function decodeMarketParams(value: unknown): MarketParams {
  const [loanToken, collateralToken, oracle, irm, lltv] = tupleValues(
    value,
    MARKET_PARAM_NAMES,
  );
  return toMarketParams({
    loanToken: loanToken as Address,
    collateralToken: collateralToken as Address,
    oracle: oracle as Address,
    irm: irm as Address,
    lltv: asBigInt(lltv, "market LLTV"),
  });
}

export function sameMarketParams(
  left: IMarketParams,
  right: IMarketParams,
): boolean {
  return toMarketParams(left).id === toMarketParams(right).id;
}

export { MarketParams };
export type { IMarketParams };
