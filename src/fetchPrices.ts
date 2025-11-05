import * as dn from "dnum";
import { Dnum } from "dnum";
import { PRICE_FEED_ADDRESS, PRICES } from "./constants";
import {
  getPriceFeedContract,
  getFlareContractRegistryContract,
  getFtsoV2Contract,
  getUniswapV3PoolContract
} from "./contracts";
import { dnum18 } from "./utils";

type CoinGeckoId = keyof typeof PRICES;
type Symbol = (typeof PRICES)[CoinGeckoId];

function isCoinGeckoId(id: string): id is CoinGeckoId {
  return id in PRICES;
}

function getCoingeckoUrl(ids: CoinGeckoId[]) {
  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("vs_currencies", "usd");
  url.searchParams.set("ids", ids.join(","));
  return url;
}

// leaving for now in case we want to add it as backup for something
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

const collateralSymbols: string[] = [];

const isCollateralSymbol = (symbol: string) => {
  return collateralSymbols.includes(symbol);
};

async function fetchCollateralPrice(symbol: string): Promise<Dnum> {
  const priceFeedContract = getPriceFeedContract(PRICE_FEED_ADDRESS);

  const [price] = await priceFeedContract.fetchPrice();

  return dnum18(price.toString());
}

// Price configuration for tokens that need special handling
const TOKEN_PRICE_CONFIG: Record<
  string,
  {
    type: "ftso" | "uniswapV3";
    poolAddress?: string;
    intermediateToken?: string;
  }
> = {
  APS: {
    type: "uniswapV3",
    poolAddress: "0x7FF1be9528Ec0B5f1D451145279b6B748BB4B81B",
    intermediateToken: "FLR"
  },
  FLR: {
    type: "ftso"
  },
  XRP: {
    type: "ftso"
  }
};

// FTSO V2 Feed IDs for different token pairs
// These are the actual feed IDs used by FTSO V2 on Flare Network
const FTSO_FEED_IDS: Record<string, `0x${string}`> = {
  "FLR/USD": "0x01464c522f55534400000000000000000000000000", // FLR/USD feed ID
  "XRP/USD": "0x015852502f55534400000000000000000000000000" // XRP/USD feed ID
};

// Helper function to get FTSO feed ID
function getFeedID(pairName: string): `0x${string}` {
  const feedId = FTSO_FEED_IDS[pairName];
  if (!feedId) {
    throw new Error(`No FTSO feed ID configured for ${pairName}`);
  }
  return feedId;
}

// Fetch price from FTSO V2
async function fetchFTSOPrice(symbol: string, blockNumber?: bigint): Promise<Dnum> {
  console.log(`Fetching FTSO price for ${symbol}`);

  const registryContract = getFlareContractRegistryContract();
  // Get FtsoV2 contract address from registry
  const ftsoV2Address = await registryContract.getContractAddressByName("FtsoV2");

  console.log(`FTSO V2 address: ${ftsoV2Address}`);

  // Get price feed
  const pairName = `${symbol}/USD`;
  const feedID = getFeedID(pairName);
  console.log(`Using feed ID ${feedID} for ${pairName}`);

  const ftsoV2Contract = getFtsoV2Contract(ftsoV2Address);

  const { value, decimals } = await ftsoV2Contract.getFeedById(feedID, {
    blockTag: blockNumber ? Number(blockNumber) : undefined
  });

  console.log(`FTSO price for ${symbol}: value=${value}, decimals=${decimals}`);

  // Convert to Dnum with proper decimals
  const divisor = 10n ** BigInt(Math.abs(Number(decimals)));
  if (decimals >= 0) {
    return dn.from(Number(value), Number(decimals));
  } else {
    return dn.from(Number(value) * Number(divisor), 18);
  }
}

// Fetch price from Uniswap V3 pool using TWAP
async function fetchUniswapV3Price(
  poolAddress: string,
  intermediateTokenSymbol: string,
  blockNumber?: bigint
): Promise<Dnum> {
  // Get TWAP price from pool observations (30 minute window)
  const twapPeriod = 1800; // 30 minutes in seconds
  console.dir(
    `Fetching Uniswap V3 price from pool ${poolAddress} with intermediate token ${intermediateTokenSymbol}`
  );

  const uniV3PoolContract = getUniswapV3PoolContract(poolAddress);

  const { tickCumulatives } = await uniV3PoolContract.observe([twapPeriod, 0], {
    ...(blockNumber && { blockTag: Number(blockNumber) })
  });

  console.dir(tickCumulatives, { depth: null });

  // Calculate average tick
  const tick0 = Number(tickCumulatives[0]);
  const tick1 = Number(tickCumulatives[1]);
  if (tick0 === undefined || tick1 === undefined) {
    throw new Error("Invalid tick cumulatives from pool");
  }
  const tickCumulativesDelta = tick1 - tick0;
  const averageTick = Number(tickCumulativesDelta) / twapPeriod;

  // Convert tick to price: price = 1.0001^tick
  const price = Math.pow(1.0001, averageTick);

  // Get the intermediate token price from FTSO
  const intermediatePrice = await fetchFTSOPrice(intermediateTokenSymbol, blockNumber);

  // Multiply to get final USD price
  return dn.mul(dn.from(price, 18), intermediatePrice);
}

export const getPrice = async (symbol: string) => {
  // Check if token has special price configuration
  const priceConfig = TOKEN_PRICE_CONFIG[symbol];
  if (priceConfig) {
    try {
      if (priceConfig.type === "ftso") {
        return await fetchFTSOPrice(symbol);
      } else if (
        priceConfig.type === "uniswapV3" &&
        priceConfig.poolAddress &&
        priceConfig.intermediateToken
      ) {
        return await fetchUniswapV3Price(priceConfig.poolAddress, priceConfig.intermediateToken);
      }
    } catch (error) {
      console.error(`Failed to fetch price for ${symbol} from ${priceConfig.type}:`, error);
      // Don't throw, continue to fallbacks
    }
  }

  // Collateral token = PriceFeed price
  if (isCollateralSymbol(symbol)) {
    return fetchCollateralPrice(symbol);
  }

  // Fallback price for BOLD (1:1 with USD)
  if (symbol === "BOLD") {
    return dn.from(1, 18); // 1 USD with 18 decimals
  }

  throw new Error(`The price for ${symbol} could not be found.`);
};

export async function fetchPrices() {
  const ids = Object.keys(PRICES) as CoinGeckoId[];

  const results = {} as Record<Symbol, string>;

  for (const id of ids) {
    const price = await getPrice(id);
    if (price) {
      results[PRICES[id]] = price.toString();
    }
  }
  return results;
}
