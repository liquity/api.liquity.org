import { Decimal } from "@liquity/lib-base";
import { BigNumber } from "ethers";
import path from "path";

export const OUTPUT_DIR = "docs";
export const OUTPUT_DIR_V1 = path.join(OUTPUT_DIR, "v1");
export const OUTPUT_DIR_V2 = path.join(OUTPUT_DIR, "v2");
export const OUTPUT_DIR_V2_GOVERNANCE = path.join(OUTPUT_DIR_V2, "governance");
export const LQTY_CIRCULATING_SUPPLY_FILE = "lqty_circulating_supply.txt";
export const LUSD_TOTAL_SUPPLY_FILE = "lusd_total_supply.txt";
export const LUSD_CB_BAMM_STATS_FILE = "lusd_cb_bamm_stats.json";

export const SPHERE_API_STABLECOIN_BORROW_RATES_URL =
  "https://sphere-api.blockanalitica.com/stablecoin-borrow/rates/";

export const COLLATERAL_TOKENS = ["WETH", "wstETH", "rETH"] as const;

export const DUNE_SPV2_AVERAGE_APY_URL_MAINNET = "https://api.dune.com/api/v1/query/5162039/results";
export const DUNE_SPV2_UPFRONT_FEE_URL_MAINNET = "https://api.dune.com/api/v1/query/5190924/results";
export const DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET =
  "https://api.dune.com/api/v1/query/5662336/results";
export const DUNE_FORK_VENUES_URL_MAINNET = "https://api.dune.com/api/v1/query/5682625/results";
export const DUNE_LEADERBOARD_URL_MAINNET = "https://api.dune.com/api/v1/query/5245634/results";

// export const TOTAL_LQTY_SUPPLY = Decimal.from(100e6); // 100 million
export const TOTAL_LQTY_SUPPLY = BigNumber.from(100e6); // 100 million probably made up

// { [coinGeckoId]: symbol }
export const PRICES = {
  ethereum: "ETH",
  liquity: "LQTY",
  "liquity-bold": "LEGACY_BOLD",
  "liquity-bold-2": "BOLD",
  "liquity-usd": "LUSD",
  "rocket-pool-eth": "RETH",
  "wrapped-steth": "WSTETH",
  smardex: "SDEX"
} as const;

export const GNOSIS_SAFE_RESERVE = "";
export const GNOSIS_SAFE_FUNDS = "";

export const REWARD_CONTRACTS = Object.freeze([
  "", // Stability Pool rewards
  "", // Uniswap v2 ETH/LUSD LP rewards
  "" //  Curve LUSD/3Pool LP rewards
]);

export const LOCKUP_CONTRACTS = Object.freeze([]);

export const FLARE_CONTRACT_REGISTRY = "0xaD67FE66660Fb8dFE9d6b1b4240d8650e30F6019";
export const PRICE_FEED_ADDRESS = "";

export const LUSD_ADDRESS = "";
export const LQTY_ADDRESS = "";
