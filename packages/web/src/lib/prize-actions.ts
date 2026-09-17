export type PrizeActionId = "checkPrize" | "addPrizeToSavings" | "claimPrize";
export type PrizeWorkingAction = PrizeActionId | undefined;

export type PrizeAction = {
  id: PrizeActionId;
  label: string;
  busyLabel: string;
  disabled: boolean;
  variant: "primary" | "secondary";
};

type PrizeActionState = {
  connected: boolean;
  ready: boolean;
  busy: boolean;
  hasPrizeToClaim: boolean;
  workingAction: PrizeWorkingAction;
};

export function getPrizeActions(state: PrizeActionState): PrizeAction[] {
  const baseDisabled = !state.connected || !state.ready || state.busy;
  const actions: PrizeAction[] = [
    {
      id: "checkPrize",
      label: "Check prize",
      busyLabel: "Checking...",
      disabled: baseDisabled,
      variant: state.hasPrizeToClaim ? "secondary" : "primary",
    },
  ];

  if (!state.hasPrizeToClaim) return actions;

  actions.push(
    {
      id: "addPrizeToSavings",
      label: "Add prize to savings",
      busyLabel: "Adding...",
      disabled: baseDisabled,
      variant: "primary",
    },
    {
      id: "claimPrize",
      label: "Claim prize",
      busyLabel: "Claiming...",
      disabled: baseDisabled,
      variant: "secondary",
    },
  );

  return actions.map((action) => ({
    ...action,
    label: state.workingAction === action.id ? action.busyLabel : action.label,
  }));
}
