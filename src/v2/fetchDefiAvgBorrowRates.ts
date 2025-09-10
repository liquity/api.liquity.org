import { z } from "zod";
import { COLLATERAL_TOKENS, SPHERE_API_STABLECOIN_BORROW_RATES_URL } from "../constants";

const zEntry = z.object({
  key: z.string()
});

const zDefiAvgBorrowRates = z.object({
  results: z.array(
    z.object({
      rate: z.string().transform(x => Number(x)),
      total_debt: z.string().transform(x => Number(x))
    })
  ),
  stablecoins: z.array(zEntry),
  collateral_tokens: z.array(zEntry),
  protocols: z.array(zEntry)
});

const apiFetch = async (params?: string) => {
  const response = await fetch(
    `${SPHERE_API_STABLECOIN_BORROW_RATES_URL}?format=json` + (params ? `&${params}` : "")
  );

  return zDefiAvgBorrowRates.parse(await response.json());
};

export const fetchDefiAvgBorrowRates = async () => {
  const { stablecoins, protocols } = await apiFetch();

  const others = protocols
    .map(x => x.key)
    .filter(x => !x.match(/liquity/i))
    .join(",");

  const tokens = stablecoins.map(x => x.key).join(",");

  return Promise.all(
    COLLATERAL_TOKENS.map(collateral =>
      apiFetch(`collateral_tokens=${collateral}&protocols=${others}&tokens=${tokens}`).then(x => ({
        collateral,
        defi_avg_borrow_rate:
          x.results.map(x => x.rate * x.total_debt).reduce((a, b) => a + b) /
          x.results.map(x => x.total_debt).reduce((a, b) => a + b)
      }))
    )
  );
};
