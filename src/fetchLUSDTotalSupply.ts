import { BlockTag } from "@ethersproject/abstract-provider";
import { BigNumber } from "@ethersproject/bignumber";
import { Contract, CallOverrides } from "@ethersproject/contracts";
import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

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

export const fetchLUSDTotalSupply = (
  liquity: EthersLiquity,
  blockTag?: BlockTag
): Promise<Decimal> =>
  lusdTokenFrom(liquity)
    .totalSupply({ blockTag })
    .then(bigNumber => Decimal.fromBigNumberString(bigNumber.toHexString()));
