import { z } from "zod";
import { duneFetch, zDuneResponse, zTypeGuard } from "./duneFetch";

const zDuneLeaderboardResponse = zDuneResponse(
  z.object({
    rank: z.number(),
    address: z.string(),
    "Modified Total": z.number(),
    "Modified %": z.number()
  })
);

const isDuneLeaderboardResponse = zTypeGuard(zDuneLeaderboardResponse);

export const fetchLeaderboardFromDune = async ({
  apiKey,
  url
}: {
  apiKey: string;
  url: string | null;
}) => {
  if (!url) return null;

  const {
    result: {
      rows,
      metadata: { total_row_count }
    }
  } = await duneFetch({
    apiKey,
    url: `${url}?limit=10`,
    validate: isDuneLeaderboardResponse
  });

  return {
    total_row_count,

    rows: rows.map(row => ({
      rank: row.rank,
      address: row.address,
      points: row["Modified Total"],
      percent: row["Modified %"]
    }))
  };
};
