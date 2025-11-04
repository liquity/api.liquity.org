import type { Provider } from "@ethersproject/abstract-provider";
import { getNetwork } from "@ethersproject/networks";

import { BatchedProvider } from "./BatchedProvider";
import { ethers } from "ethers";
import dotenv from "dotenv-safe";
dotenv.config();

const FLARE_CHAIN_ID = 14;

export const getProvider = (): Provider => {
  const network = getNetwork(FLARE_CHAIN_ID);

  const RPC_URL = process.env.RPC_URL;
  if (!RPC_URL) {
    throw new Error("RPC_URL must be set");
  }

  const rpc = new ethers.providers.JsonRpcProvider(RPC_URL);

  return new BatchedProvider(rpc, network);
};
