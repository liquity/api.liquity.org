import { AlchemyProvider } from "@ethersproject/providers";
import { Networkish, getNetwork } from "@ethersproject/networks";
import { EthersLiquity } from "@liquity/lib-ethers";
import { Batched, WebSocketAugmented } from "@liquity/providers";

const BatchedWebSocketAugmentedAlchemyProvider = Batched(WebSocketAugmented(AlchemyProvider));

export interface LiquityConnectionOptions {
  alchemyApiKey?: string;
  useWebSocket?: boolean;
}

export const connectToLiquity = (
  networkish: Networkish,
  options?: LiquityConnectionOptions
): Promise<EthersLiquity> => {
  const network = getNetwork(networkish);
  const provider = new BatchedWebSocketAugmentedAlchemyProvider(network, options?.alchemyApiKey);
  const liquity = EthersLiquity.connect(provider);

  provider.chainId = network.chainId;

  if (options?.useWebSocket) {
    provider.openWebSocket(
      provider.connection.url.replace(/^http/i, "ws").replace(".alchemyapi.", ".ws.alchemyapi."),
      network
    );
  }

  return liquity;
};
