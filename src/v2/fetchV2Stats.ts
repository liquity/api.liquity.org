import type { BlockTag, Provider } from "@ethersproject/abstract-provider";
import type { BigNumber } from "@ethersproject/bignumber";
import { AddressZero } from "@ethersproject/constants";
import { resolveProperties } from "@ethersproject/properties";
import { Decimal } from "@liquity/lib-base";

import { duneFetch, type DuneResponse, isDuneResponse } from "../dune";
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

const isDuneSpAverageApyResponse = (
  data: unknown
): data is DuneResponse<{
  apr: number;
  collateral_type: string;
}> =>
  isDuneResponse(data) &&
  data.result.rows.length > 0 &&
  data.result.rows.every(
    (row: unknown) =>
      typeof row === "object" &&
      row !== null &&
      "collateral_type" in row &&
      typeof row.collateral_type === "string" &&
      "apr" in row &&
      typeof row.apr === "number"
  );

const fetchSpAverageApysFromDune = async ({
  branches,
  apiKey,
  url
}: {
  branches: LiquityV2BranchContracts[];
  apiKey: string;
  url: string | null;
}) => {
  // disabled when DUNE_SPV2_AVERAGE_APY_URL_* is null
  if (!url) {
    return null;
  }

  const {
    result: { rows: sevenDaysApys }
  } = await duneFetch({
    apiKey,
    url: `${url}?limit=${branches.length * 7}`,
    validate: isDuneSpAverageApyResponse
  });

  return Object.fromEntries(
    branches.map(branch => {
      const apys = sevenDaysApys.filter(row => row.collateral_type === branch.collSymbol);
      return [
        branch.collSymbol,
        {
          apy_avg_1d: apys[0].apr,
          apy_avg_7d: apys.reduce((acc, { apr }) => acc + apr, 0) / apys.length
        }
      ];
    })
  ) as Record<
    string,
    {
      apy_avg_1d: number;
      apy_avg_7d: number;
    }
  >;
};

const isDuneSpUpfrontFeeResponse = (
  data: unknown
): data is DuneResponse<{
  collateral_type: string;
  upfront_fees: number;
}> =>
  isDuneResponse(data) &&
  data.result.rows.every(
    row =>
      typeof row === "object" &&
      row !== null &&
      "collateral_type" in row &&
      typeof row.collateral_type === "string" &&
      "upfront_fees" in row &&
      typeof row.upfront_fees === "number"
  );

export const fetchBoldYieldOpportunitiesFromDune = async (
  {
    apiKey,
    url
  }: {
  apiKey: string;
  url: string | null;
}) => {
  if (!url) return null;

  const {
    result: { rows }
  } = await duneFetch({
    apiKey,
    url,
    validate: isDuneBoldYieldOpportunitiesResponse
  });

  const extractLink = (htmlLink?: string): string | undefined => {
    if (!htmlLink) return undefined;
    const match = htmlLink.match(/href=(?:"|')?([^"'\s>]+)/i);
    return match?.[1];
  };

  return rows
    .slice(0, 3).map(row => ({
      asset: row.asset,
      weekly_apr: row.weekly_apr,
      tvl: row.tvl,
      link: extractLink(row.link),
      protocol: row.protocol
    }));
};

const isDuneBoldYieldOpportunitiesResponse = (
  data: unknown
): data is DuneResponse<{
  asset: string;
  weekly_apr: number;
  tvl: number;
  link?: string;
  protocol: string;
}> =>
  isDuneResponse(data) &&
  data.result.rows.every(
    row =>
      typeof row === "object" &&
      row !== null &&
      "asset" in row &&
      typeof row.asset === "string" &&
      "weekly_apr" in row &&
      typeof row.weekly_apr === "number" &&
      "tvl" in row &&
      typeof row.tvl === "number" &&
      "protocol" in row &&
      typeof row.protocol === "string"
  );

const fetchSpUpfrontFeeFromDune = async ({
  apiKey,
  url
}: {
  apiKey: string;
  url: string | null;
}) => {
  if (!url) return null;
  const { result } = await duneFetch({ apiKey, url, validate: isDuneSpUpfrontFeeResponse });
  return Object.fromEntries(result.rows.map(row => [row.collateral_type, row.upfront_fees]));
};

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

  const [total_bold_supply, branches, spV2AverageApys, spUpfrontFee24h, boldYield] = await Promise.all([
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

    deployed ? fetchBoldYieldOpportunitiesFromDune({
      apiKey: duneApiKey,
      url: duneYieldUrl
    }) : null
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
    boldYield: boldYield,
  };
};
