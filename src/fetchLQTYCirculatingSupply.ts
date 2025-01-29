import { BlockTag } from "@ethersproject/abstract-provider";
import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

import { TOTAL_LQTY_SUPPLY } from "./constants";
import { getExcludedLQTYHolders } from "./excludedLQTYHolders";

const getLQTYBalance = (liquity: EthersLiquity, blockTag: BlockTag) => (address: string) =>
  liquity.getLQTYBalance(address, { blockTag });

const subtract = (a: Decimal, b: Decimal) => a.sub(b);

const subtractAllFrom = (initialValue: Decimal) => (xs: Decimal[]) =>
  xs.reduce(subtract, initialValue);

export const fetchLQTYCirculatingSupply = async (
  liquity: EthersLiquity,
  blockTag: BlockTag = "latest"
): Promise<Decimal> => {
  const excludedAddresses = await getExcludedLQTYHolders(liquity, blockTag);

  return Promise.all(excludedAddresses.map(getLQTYBalance(liquity, blockTag))).then(
    subtractAllFrom(TOTAL_LQTY_SUPPLY)
  );
};
