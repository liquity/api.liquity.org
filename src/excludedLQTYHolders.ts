import { BlockTag, Provider } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { CallOverrides, Contract } from "@ethersproject/contracts";
import { EthersLiquity } from "@liquity/lib-ethers";

import {
  GNOSIS_SAFE_RESERVE,
  GNOSIS_SAFE_FUNDS,
  REWARD_CONTRACTS,
  LOCKUP_CONTRACTS
} from "./constants.js";

const oneYear = 365 * 24 * 60 * 60;

const lockupContractAbi = ["function unlockTime() view returns (uint256)"];

interface LockupContract extends Contract {
  unlockTime(overrides?: CallOverrides): Promise<BigNumber>;
}

const lockupContract = (provider: Provider) => (address: string) =>
  new Contract(address, lockupContractAbi, provider) as unknown as LockupContract;

const getUnlockTimestamp = (lockupContract: LockupContract) =>
  lockupContract
    .unlockTime()
    .then<[number, string]>(unlockTimestamp => [unlockTimestamp.toNumber(), lockupContract.address]);

const snd = <T>([, b]: [unknown, T]) => b;

export const getExcludedLQTYHolders = async (
  liquity: EthersLiquity,
  blockTag: BlockTag
): Promise<string[]> => {
  const provider = liquity.connection.provider;
  const deploymentTimestamp = liquity.connection.deploymentDate.getTime() / 1000;

  const [block, ...lockupContracts] = await Promise.all([
    provider.getBlock(blockTag),
    ...LOCKUP_CONTRACTS.map(lockupContract(provider)).map(getUnlockTimestamp)
  ]);

  const timestamp = block.timestamp;

  return [
    GNOSIS_SAFE_RESERVE,
    ...(timestamp < deploymentTimestamp + oneYear ? [GNOSIS_SAFE_FUNDS] : []),
    ...lockupContracts.filter(([unlockTimestamp]) => timestamp < unlockTimestamp).map(snd),
    ...REWARD_CONTRACTS
  ];
};
