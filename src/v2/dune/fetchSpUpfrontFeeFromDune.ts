import { z } from "zod";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";

const zDuneSpUpfrontFeeResponse = zDuneResponse(
  z.object({
    collateral_type: z.string(),
    upfront_fees: z.number()
  })
);

const isDuneSpUpfrontFeeResponse = zTypeGuard(zDuneSpUpfrontFeeResponse);

export const fetchSpUpfrontFeeFromDune = async ({
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
