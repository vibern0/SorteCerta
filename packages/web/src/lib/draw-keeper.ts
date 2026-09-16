export type DrawKeeperAction = "close";

export type DrawKeeperSnapshot = {
  now: bigint;
  nextDrawAt: bigint;
  participantCount: bigint;
  publicPrizeReserve: bigint;
  minimumPrize: bigint;
};

export function chooseDrawKeeperAction(snapshot: DrawKeeperSnapshot): DrawKeeperAction | undefined {
  if (snapshot.now < snapshot.nextDrawAt) return undefined;
  if (snapshot.participantCount <= 0n) return undefined;
  if (snapshot.publicPrizeReserve < snapshot.minimumPrize) return undefined;
  return "close";
}
