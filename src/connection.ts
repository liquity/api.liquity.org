import type { Provider } from "@ethersproject/abstract-provider";
import { Networkish, getNetwork } from "@ethersproject/networks";
import { Batched, WebSocketAugmented } from "@liquity/providers";

import { AlchemyProvider } from "./AlchemyProvider.js";

const BatchedWebSocketAugmentedAlchemyProvider = Batched(WebSocketAugmented(AlchemyProvider));

export interface LiquityConnectionOptions {
  alchemyApiKey?: string;
  useWebSocket?: boolean;
}

export const getProvider = (
  networkish: Networkish,
  options?: LiquityConnectionOptions
): Provider => {
  const network = getNetwork(networkish);
  const provider = new BatchedWebSocketAugmentedAlchemyProvider(network, options?.alchemyApiKey);

  provider.chainId = network.chainId;

  if (options?.useWebSocket) {
    provider.openWebSocket(
      provider.connection.url.replace(/^http/i, "ws").replace(".alchemyapi.", ".ws.alchemyapi."),
      network
    );
  }

  return provider;
};
