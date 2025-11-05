import { getProvider } from "./connection";

import { FLARE_CONTRACT_REGISTRY } from "./constants";

import {
  ERC20__factory,
  FlareContractRegistry__factory,
  FtsoV2__factory,
  PriceFeed__factory,
  UniswapV3Pool__factory
} from "./types";

export const getFlareContractRegistryContract = () => {
  return FlareContractRegistry__factory.connect(FLARE_CONTRACT_REGISTRY, getProvider());
};

export const getFtsoV2Contract = (ftsoAddress: string) => {
  return FtsoV2__factory.connect(ftsoAddress, getProvider());
};

export const getUniswapV3PoolContract = (poolAddress: string) => {
  return UniswapV3Pool__factory.connect(poolAddress, getProvider());
};

export const getPriceFeedContract = (priceFeedAddress: string) => {
  return PriceFeed__factory.connect(priceFeedAddress, getProvider());
};

export const getERC20Contract = (erc20Address: string) => {
  return ERC20__factory.connect(erc20Address, getProvider());
};
