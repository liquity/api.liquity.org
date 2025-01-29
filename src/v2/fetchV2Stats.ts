import type { BlockTag, Provider } from "@ethersproject/abstract-provider";
import type { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { resolveProperties } from "@ethersproject/properties";
import { Decimal } from "@liquity/lib-base";
import { DUNE_SPV2_AVERAGE_APY_URL_MAINNET, DUNE_SPV2_AVERAGE_APY_URL_SEPOLIA } from "../constants";

import { getContracts, LiquityV2BranchContracts, type LiquityV2Deployment } from "./contracts";

const ONE_WEI = Decimal.fromBigNumberString("1");

const decimalify = (bigNumber: BigNumber) => Decimal.fromBigNumberString(bigNumber.toHexString());

const mapObj = <T extends Record<string, any>, U>(t: T, f: (v: T[keyof T]) => U) =>
  Object.fromEntries(Object.entries(t).map(([k, v]) => [k, f(v)])) as { [K in keyof T]: U };

const fetchBranchData = async (
  branches: LiquityV2BranchContracts[],
  blockTag: BlockTag = "latest"
) =>
  Promise.all(
    branches.map(branch =>
      resolveProperties({
        coll_symbol: branch.collSymbol,
        coll_active: branch.activePool.getCollBalance({ blockTag }).then(decimalify),
        coll_default: branch.defaultPool.getCollBalance({ blockTag }).then(decimalify),
        coll_price: branch.priceFeed.callStatic
          .fetchPrice({ blockTag })
          .then(([x]) => x)
          .then(decimalify),
        sp_deposits: branch.stabilityPool.getTotalBoldDeposits({ blockTag }).then(decimalify),
        interest_accrual_1y: branch.activePool
          .aggWeightedDebtSum({ blockTag })
          .then(decimalify)
          .then(x => x.mul(ONE_WEI)),
        interest_pending: branch.activePool.calcPendingAggInterest({ blockTag }).then(decimalify),
        batch_management_fees_pending: Promise.all([
          branch.activePool.aggBatchManagementFees({ blockTag }).then(decimalify),
          branch.activePool.calcPendingAggBatchManagementFee({ blockTag }).then(decimalify)
        ]).then(([a, b]) => a.add(b))
      })
    )
  );

const emptyBranchData = (branches: LiquityV2BranchContracts[]): ReturnType<typeof fetchBranchData> =>
  Promise.resolve(
    branches.map(branch => ({
      coll_symbol: branch.collSymbol,
      coll_active: Decimal.ZERO,
      coll_default: Decimal.ZERO,
      coll_price: Decimal.ZERO,
      sp_deposits: Decimal.ZERO,
      interest_accrual_1y: Decimal.ZERO,
      interest_pending: Decimal.ZERO,
      batch_management_fees_pending: Decimal.ZERO
    }))
  );

const fetchSpAverageApys = async (
  branches: LiquityV2BranchContracts[],
  duneQueryUrl: string,
  duneApiKey: string
) => {
  const response = await fetch(`${duneQueryUrl}?limit=${branches.length}`, {
    headers: { "X-Dune-API-Key": duneApiKey }
  });

  const data = await response.json() as {
    result?: {
      rows?: {
        collateral_type?: string;
        apr?: number;
      }[];
    };
  };

  if (data.result?.rows?.length !== branches.length) {
    throw new Error("Dune query returned unexpected number of rows");
  }

  return data.result.rows.map(row => {
    if (typeof row.apr !== "number") {
      throw new Error("Dune query returned undefined APR");
    }
    if (typeof row.collateral_type !== "string") {
      throw new Error("Dune query returned undefined collateral type");
    }

    let symbol = row.collateral_type.toUpperCase();
    if (symbol === "WSTETH") symbol = "wstETH";
    if (symbol === "RETH") symbol = "rETH";

    return { symbol, avg_apy: row.apr };
  });
};

export const fetchV2Stats = async (
  network: "mainnet" | "sepolia",
  provider: Provider,
  duneApiKey: string,
  deployment: LiquityV2Deployment,
  blockTag: BlockTag = "latest"
) => {
  const SP_YIELD_SPLIT = Number(Decimal.fromBigNumberString(deployment.constants.SP_YIELD_SPLIT));
  const contracts = getContracts(provider, deployment);

  // Last step of deployment renounces Governance ownership
  const deployed = await contracts.governance
    .owner()
    .then(owner => owner == AddressZero)
    .catch(() => false);

  const spV2AverageApyUrl = network === "mainnet"
    ? DUNE_SPV2_AVERAGE_APY_URL_MAINNET
    : network === "sepolia"
    ? DUNE_SPV2_AVERAGE_APY_URL_SEPOLIA
    : null;

  const [total_bold_supply, branches, spV2AverageApys] = await Promise.all([
    deployed ? contracts.boldToken.totalSupply({ blockTag }).then(decimalify) : Decimal.ZERO,

    (deployed ? fetchBranchData : emptyBranchData)(contracts.branches)
      .then(branches =>
        branches.map(branch => ({
          ...branch,
          debt_pending: branch.interest_pending.add(branch.batch_management_fees_pending),
          coll_value: branch.coll_active.add(branch.coll_default).mul(branch.coll_price),
          sp_apy: (SP_YIELD_SPLIT * Number(branch.interest_accrual_1y)) / Number(branch.sp_deposits)
        }))
      )
      .then(branches =>
        branches.map(branch => ({
          ...branch,
          value_locked: branch.coll_value.add(branch.sp_deposits) // taking BOLD at face value
        }))
      ),

    deployed && spV2AverageApyUrl
      ? fetchSpAverageApys(contracts.branches, spV2AverageApyUrl, duneApiKey)
      : null
  ]);

  const sp_apys = branches.map(b => b.sp_apy).filter(x => !isNaN(x));

  return {
    total_bold_supply: `${total_bold_supply}`,
    total_debt_pending: `${branches.map(b => b.debt_pending).reduce((a, b) => a.add(b))}`,
    total_coll_value: `${branches.map(b => b.coll_value).reduce((a, b) => a.add(b))}`,
    total_sp_deposits: `${branches.map(b => b.sp_deposits).reduce((a, b) => a.add(b))}`,
    total_value_locked: `${branches.map(b => b.value_locked).reduce((a, b) => a.add(b))}`,
    max_sp_apy: `${sp_apys.length > 0 ? Math.max(...sp_apys) : NaN}`,

    branch: Object.fromEntries(
      branches.map(({ coll_symbol, ...branch }) => {
        const sp_apy_avg = spV2AverageApys?.find(x => x.symbol === coll_symbol)?.avg_apy;
        return [
          coll_symbol,
          mapObj({
            ...branch,
            ...(typeof sp_apy_avg === "number" ? { sp_apy_avg } : {})
          }, x => `${x}`)
        ];
      })
    )
  };
};
