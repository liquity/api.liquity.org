import { z } from "zod";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";
import { extractLink } from "./utils";

const zDuneForkVenuesResponse = zDuneResponse(
  z.object({
    fork: z.string(),
    asset: z.string(),
    link: z.string().nullable(),
    protocol: z.string(),
    chain: z.string(),
    total_apr: z.string().nullable(),
    tvl: z.number().nullable()
  })
);

const isDuneForkVenuesResponse = zTypeGuard(zDuneForkVenuesResponse);

export const fetchForkVenuesFromDune = async ({
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
    validate: isDuneForkVenuesResponse
  });

  return rows.map(row => ({
    fork: row.fork,
    asset: row.asset,
    link: extractLink(row.link),
    protocol: row.protocol,
    chain: row.chain,
    total_apr: row.total_apr,
    tvl: row.tvl
  }));
};
