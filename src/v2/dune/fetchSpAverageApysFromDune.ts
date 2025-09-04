import { z } from "zod";
import type { LiquityV2BranchContracts } from "../contracts";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";

const zDuneSpAverageApyResponse = zDuneResponse(
  z.object({
    apr: z.number(),
    collateral_type: z.string()
  })
);

const isDuneSpAverageApyResponse = zTypeGuard(zDuneSpAverageApyResponse);

export const fetchSpAverageApysFromDune = async ({
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
