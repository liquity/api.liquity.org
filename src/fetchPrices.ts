const API_KEY = process.env.COINGECKO_DEMO_KEY;

const PRICES = {
  "ethereum": "ETH",
  "legacy-bold": "LEGACY_BOLD",
  "liquity": "LQTY",
  "liquity-bold": "BOLD",
  "liquity-usd": "LUSD",
  "rocket-pool-eth": "RETH",
  "wrapped-steth": "WSTETH"
} as const;

type CoinGeckoId = keyof typeof PRICES;
type Symbol = typeof PRICES[CoinGeckoId];

function isCoinGeckoId(id: string): id is CoinGeckoId {
  return id in PRICES;
}

function getCoingeckoUrl(ids: CoinGeckoId[]) {
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("ids", ids.join(","));
  return url;
}

function isCoinGeckoResult(result: unknown): result is Record<CoinGeckoId, { usd: number }> {
  // check if result is an object and has a result property
  if (typeof result !== "object" || result === null) {
    return false;
  }
  for (const [id, value] of Object.entries(result) as Array<[string, unknown]>) {
    // check if id is a valid CoinGeckoId
    if (!isCoinGeckoId(id)) {
      return false;
    }
    // check if value is an object and not null
    if (typeof value !== "object" || value === null) {
      return false;
    }
    // check if value has a usd property of type number
    if (!("usd" in value) || typeof value["usd"] !== "number") {
      return false;
    }
  }
  return true;
}

export async function fetchPrices() {
  const ids = Object.keys(PRICES) as CoinGeckoId[];

  const response = await fetch(getCoingeckoUrl(ids), {
    headers: {
      "accept": "application/json",
      "x-cg-demo-api-key": KEY
    }
  });

  if (!response.ok) {
    console.error("Failed to fetch prices from CoinGecko API:", response.statusText);
    throw new Error("Failed to fetch prices from CoinGecko API");
  }

  const result = await response.json().catch((error) => {
    console.error("Error parsing JSON response from CoinGecko API:", error);
    throw new Error("Error parsing JSON response from CoinGecko API");
  });

  if (!isCoinGeckoResult(result)) {
    console.error("Invalid response format from CoinGecko API:", result);
    throw new Error("Invalid response format from CoinGecko API");
  }

  return Object.fromEntries(
    Object.entries(result).map(([id, value]) => {
      if (!isCoinGeckoId(id)) {
        throw new Error(`Unexpected CoinGecko ID: ${id}`);
      }
      if (value.usd <= 0) {
        throw new Error(`Invalid price for ${id}: ${value.usd}`);
      }
      return [PRICES[id], String(value.usd)];
    })
  ) as Record<Symbol, string>;
}
