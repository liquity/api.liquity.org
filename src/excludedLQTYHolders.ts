import { REWARD_CONTRACTS } from "./constants";

export const getExcludedLQTYHolders = async (): Promise<string[]> => {
  return [
    ...REWARD_CONTRACTS
    // lockup contracts if exist
    // gnosis safe reserve and funds if exist
  ];
};
