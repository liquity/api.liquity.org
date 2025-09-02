import type { Provider } from "@ethersproject/abstract-provider";
import { Networkish, getNetwork } from "@ethersproject/networks";
import { InfuraProvider } from "@ethersproject/providers";

import { AlchemyProvider } from "./AlchemyProvider";
import { BatchedProvider } from "./BatchedProvider";

export interface LiquityConnectionOptions {
  provider?: "alchemy" | "infura"; // defaults to Alchemy
  alchemyApiKey?: string;
  infuraApiKey?: string;
}

export const getProvider = (
  networkish: Networkish,
  options?: LiquityConnectionOptions
): Provider => {
  const network = getNetwork(networkish);
  const underlyingProvider =
    options?.provider === "infura"
      ? new InfuraProvider(network, options?.infuraApiKey)
      : new AlchemyProvider(network, options?.alchemyApiKey);

  return new BatchedProvider(underlyingProvider, network);
};
