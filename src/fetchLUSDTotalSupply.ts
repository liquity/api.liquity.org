import { BlockTag } from "@ethersproject/abstract-provider";
import { Decimal } from "@liquity/lib-base";
import { LUSD_ADDRESS } from "./constants";
import { getERC20Contract } from "./contracts";

export const fetchLUSDTotalSupply = (blockTag?: BlockTag): Promise<Decimal> => {
  const lusdToken = getERC20Contract(LUSD_ADDRESS);

  return lusdToken
    .totalSupply({ blockTag })
    .then(bigNumber => Decimal.fromBigNumberString(bigNumber.toHexString()));
};
