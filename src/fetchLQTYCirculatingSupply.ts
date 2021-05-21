import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

const TOTAL_SUPPLY = Decimal.from(100e6);

export const fetchLQTYCirculatingSupply = (
  liquity: EthersLiquity,
  excludedAddresses: readonly string[],
  blockTag?: number
): Promise<Decimal> =>
  Promise.all(excludedAddresses.map(address => liquity.getLQTYBalance(address, { blockTag }))).then(
    lockedLQTY => lockedLQTY.reduce((a, b) => a.sub(b), TOTAL_SUPPLY)
  );
