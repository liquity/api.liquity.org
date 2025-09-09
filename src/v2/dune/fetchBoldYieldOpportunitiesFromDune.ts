import { z } from "zod";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";
import { extractLink } from "./utils";

const zDuneBoldYieldOpportunitiesResponse = zDuneResponse(
  z.object({
    protocol: z.string(),
    asset: z.string(),
    link: z.string().nullable(),
    weekly_apr: z.number().nullable(),
    total_apr: z.string().nullable(),
    tvl: z.number().nullable()
  })
);

const isDuneBoldYieldOpportunitiesResponse = zTypeGuard(zDuneBoldYieldOpportunitiesResponse);

export const fetchBoldYieldOpportunitiesFromDune = async ({
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

  return rows.map(row => ({
    protocol: row.protocol,
    asset: row.asset,
    link: extractLink(row.link),
    weekly_apr: row.weekly_apr,
    total_apr: row.total_apr,
    tvl: row.tvl
  }));
};
