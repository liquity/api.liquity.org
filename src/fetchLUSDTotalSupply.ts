import { BlockTag } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, CallOverrides } from "@ethersproject/contracts";
import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";
import { getProvider } from "./connection";
import { LUSD_ADDRESS } from "./constants";

const erc20TotalSupplyAbi = ["function totalSupply() view returns (uint256)"];

interface ERC20TotalSupply {
  totalSupply(overrides?: CallOverrides): Promise<BigNumber>;
}

const lusdTokenFrom = (liquity: EthersLiquity) =>
  new Contract(
    liquity.connection.addresses["lusdToken"],
    erc20TotalSupplyAbi,
    liquity.connection.provider
  ) as unknown as ERC20TotalSupply;

export const fetchLUSDTotalSupply = (blockTag?: BlockTag): Promise<Decimal> => {
  const lusdToken = new Contract(
    LUSD_ADDRESS,
    erc20TotalSupplyAbi,
    getProvider()
  ) as unknown as ERC20TotalSupply;
  return lusdToken
    .totalSupply({ blockTag })
    .then(bigNumber => Decimal.fromBigNumberString(bigNumber.toHexString()));
};
