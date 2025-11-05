import { BlockTag } from "@ethersproject/abstract-provider";
import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

import { LQTY_ADDRESS, TOTAL_LQTY_SUPPLY } from "./constants";
import { getExcludedLQTYHolders } from "./excludedLQTYHolders";
import { getERC20Contract } from "./contracts";
import { BigNumber } from "ethers";

const getLQTYBalance = (blockTag: BlockTag) => async (address: string) => {
  const LQTYContract = getERC20Contract(LQTY_ADDRESS);
  return await LQTYContract.balanceOf(address, { blockTag });
};

const subtract = (a: BigNumber, b: BigNumber) => a.sub(b);

const subtractAllFrom = (initialValue: BigNumber) => (xs: BigNumber[]) =>
  xs.reduce(subtract, initialValue);

export const fetchLQTYCirculatingSupply = async (
  liquity: EthersLiquity,
  blockTag: BlockTag = "latest"
): Promise<BigNumber> => {
  const excludedAddresses = await getExcludedLQTYHolders(liquity, blockTag);

  return Promise.all(excludedAddresses.map(getLQTYBalance(blockTag))).then(
    subtractAllFrom(TOTAL_LQTY_SUPPLY)
  );
};
