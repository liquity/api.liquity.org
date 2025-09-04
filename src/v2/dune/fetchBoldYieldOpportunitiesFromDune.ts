import { z } from "zod";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";

const zDuneBoldYieldOpportunitiesResponse = zDuneResponse(
  z.object({
    asset: z.string(),
    weekly_apr: z.number().nullable(),
    tvl: z.number(),
    link: z.string().optional(),
    protocol: z.string()
  })
);

const isDuneBoldYieldOpportunitiesResponse = zTypeGuard(zDuneBoldYieldOpportunitiesResponse);

const extractLink = (htmlLink?: string): string | undefined => {
  if (!htmlLink) return undefined;
  const match = htmlLink.match(/href=(?:"|')?([^"'\s>]+)/i);
  return match?.[1];
};

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
    asset: row.asset,
    weekly_apr: row.weekly_apr,
    tvl: row.tvl,
    link: extractLink(row.link),
    protocol: row.protocol
  }));
};
