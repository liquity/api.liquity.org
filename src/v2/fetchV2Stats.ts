import type { BlockTag, Provider } from "@ethersproject/abstract-provider";
import type { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { resolveProperties } from "@ethersproject/properties";
import { Decimal } from "@liquity/lib-base";

import { getContracts, type LiquityV2BranchContracts, type LiquityV2Deployment } from "./contracts";
import { fetchSpAverageApysFromDune } from "./dune/fetchSpAverageApysFromDune";
import { fetchSpUpfrontFeeFromDune } from "./dune/fetchSpUpfrontFeeFromDune";
import { fetchBoldYieldOpportunitiesFromDune } from "./dune/fetchBoldYieldOpportunitiesFromDune";

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

export const fetchV2Stats = async ({
  provider,
  duneSpApyUrl,
  duneSpUpfrontFeeUrl,
  duneApiKey,
  deployment,
  duneYieldUrl,
  blockTag = "latest"
}: {
  provider: Provider;
  duneSpApyUrl: string | null;
  duneSpUpfrontFeeUrl: string | null;
  duneApiKey: string;
  deployment: LiquityV2Deployment;
  duneYieldUrl: string | null;
  blockTag?: BlockTag;
}) => {
  const SP_YIELD_SPLIT = Number(Decimal.fromBigNumberString(deployment.constants.SP_YIELD_SPLIT));
  const contracts = getContracts(provider, deployment);

  // Last step of deployment renounces Governance ownership
  const deployed = await contracts.governance
    .owner()
    .then(owner => owner == AddressZero)
    .catch(() => false);

  const [total_bold_supply, branches, spV2AverageApys, spUpfrontFee24h, boldYield] =
    await Promise.all([
      // total_bold_supply
      deployed ? contracts.boldToken.totalSupply({ blockTag }).then(decimalify) : Decimal.ZERO,

      // branches
      (deployed ? fetchBranchData : emptyBranchData)(contracts.branches)
        .then(branches => {
          return branches.map(branch => {
            const sp_deposits = Number(branch.sp_deposits);
            return {
              ...branch,
              debt_pending: branch.interest_pending.add(branch.batch_management_fees_pending),
              coll_value: branch.coll_active.add(branch.coll_default).mul(branch.coll_price),
              sp_apy:
                sp_deposits === 0
                  ? 0
                  : (SP_YIELD_SPLIT * Number(branch.interest_accrual_1y)) / sp_deposits
            };
          });
        })
        .then(branches => {
          return branches.map(branch => ({
            ...branch,
            value_locked: branch.coll_value.add(branch.sp_deposits) // taking BOLD at face value
          }));
        }),

      // spV2AverageApys
      deployed
        ? fetchSpAverageApysFromDune({
            branches: contracts.branches,
            apiKey: duneApiKey,
            url: duneSpApyUrl
          })
        : null,

      // spUpfrontFee24h
      deployed
        ? fetchSpUpfrontFeeFromDune({
            apiKey: duneApiKey,
            url: duneSpUpfrontFeeUrl
          })
        : null,

      deployed
        ? fetchBoldYieldOpportunitiesFromDune({
            apiKey: duneApiKey,
            url: duneYieldUrl
          })
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
      branches.map(({ coll_symbol, sp_apy, ...branch }) => {
        const sp_apy_avg_1d =
          spUpfrontFee24h && branch.sp_deposits.nonZero
            ? sp_apy + (365 * (spUpfrontFee24h[coll_symbol] ?? 0)) / Number(branch.sp_deposits)
            : undefined;

        const sp_apy_avg_7d = spV2AverageApys?.[coll_symbol].apy_avg_7d;

        return [
          coll_symbol,
          mapObj(
            {
              ...branch,
              sp_apy,
              apy_avg: sp_apy,
              ...(sp_apy_avg_1d !== undefined ? { sp_apy_avg_1d } : {}),
              ...(sp_apy_avg_7d !== undefined ? { sp_apy_avg_7d } : {})
            },
            x => `${x}`
          )
        ];
      })
    ),
    boldYield: boldYield?.slice(0, 3) ?? null
  };
};
