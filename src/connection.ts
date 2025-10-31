import type { Provider } from "@ethersproject/abstract-provider";
import { Networkish, getNetwork } from "@ethersproject/networks";

import { BatchedProvider } from "./BatchedProvider";
import { ethers } from "ethers";
import dotenv from "dotenv-safe";
dotenv.config();

export interface LiquityConnectionOptions {
  provider?: "alchemy" | "infura"; // defaults to Alchemy
  alchemyApiKey?: string;
  infuraApiKey?: string;
}

export const getProvider = (networkish: Networkish): Provider => {
  const network = getNetwork(networkish);

  const RPC_URL = process.env.RPC_URL;
  if (!RPC_URL) {
    throw new Error("RPC_URL must be set");
  }

  const rpc = new ethers.providers.JsonRpcProvider(RPC_URL);

  return new BatchedProvider(rpc, network);
};
