const marketParamsComponents = [
  { type: "address", name: "loanToken" },
  { type: "address", name: "collateralToken" },
  { type: "address", name: "oracle" },
  { type: "address", name: "irm" },
  { type: "uint256", name: "lltv" },
] as const;

function addressGetter(name: string) {
  return { type: "function", name, stateMutability: "view", inputs: [], outputs: [{ type: "address" }] } as const;
}

function uintGetter(name: string) {
  return { type: "function", name, stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] } as const;
}

export const morphoYieldAdapterAbi = [
  addressGetter("usdc"),
  addressGetter("confidentialUsdc"),
  addressGetter("prizePool"),
  addressGetter("morpho"),
  { type: "function", name: "marketId", stateMutability: "view", inputs: [], outputs: [{ type: "bytes32" }] },
  uintGetter("suppliedPrincipal"),
  uintGetter("idlePrincipal"),
  uintGetter("availablePrincipalAssets"),
  uintGetter("accruedYieldAssets"),
  uintGetter("suppliedAssets"),
  {
    type: "function",
    name: "marketParams",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "tuple", components: marketParamsComponents }],
  },
] as const;
