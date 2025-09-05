import { Decimal } from "@liquity/lib-base";
import path from "path";

export const OUTPUT_DIR = "docs";
export const OUTPUT_DIR_V1 = path.join(OUTPUT_DIR, "v1");
export const OUTPUT_DIR_V2 = path.join(OUTPUT_DIR, "v2");
export const LQTY_CIRCULATING_SUPPLY_FILE = "lqty_circulating_supply.txt";
export const LUSD_TOTAL_SUPPLY_FILE = "lusd_total_supply.txt";
export const LUSD_CB_BAMM_STATS_FILE = "lusd_cb_bamm_stats.json";

export const DUNE_SPV2_AVERAGE_APY_URL_MAINNET = "https://api.dune.com/api/v1/query/5162039/results";
export const DUNE_SPV2_UPFRONT_FEE_URL_MAINNET = "https://api.dune.com/api/v1/query/5190924/results";
export const DUNE_BOLD_YIELD_OPPORTUNITIES_URL_MAINNET =
  "https://api.dune.com/api/v1/query/5486369/results";
export const DUNE_FORK_VENUES_URL_MAINNET = "https://api.dune.com/api/v1/query/5682625/results";
export const DUNE_LEADERBOARD_URL_MAINNET = "https://api.dune.com/api/v1/query/5691758/results";

export const TOTAL_LQTY_SUPPLY = Decimal.from(100e6); // 100 million

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

// DO NOT TOUCH THIS
// No token outside of these should be exposed under the "prices" field,
// otherwise we break legacy (pre-v1.7) versions of the frontend due to
// an overly strict valibot schema
export const SAFE_PRICES = new Set([
  "ETH",
  "RETH",
  "WSTETH",
  "BOLD",
  "LEGACY_BOLD",
  "LQTY",
  "LUSD",
  "SBOLD"
]);

export const GNOSIS_SAFE_RESERVE = "0xb8a9fada75c6d891fb77a7988ff9bad9e485ca1c";
export const GNOSIS_SAFE_FUNDS = "0xf06016d822943c42e3cb7fc3a6a3b1889c1045f8";

export const REWARD_CONTRACTS = Object.freeze([
  "0xd8c9d9071123a059c6e0a945cf0e0c82b508d816", // Stability Pool rewards
  "0xd37a77e71ddf3373a79be2ebb76b6c4808bdf0d5", // Uniswap v2 ETH/LUSD LP rewards
  "0xeb31da939878d1d780fdbcc244531c0fb80a2cf3" //  Curve LUSD/3Pool LP rewards
]);

export const LOCKUP_CONTRACTS = Object.freeze([
  "0x241aD9DfC7466C5299d622DF7664B71AB60Fe8D6",
  "0xd651d97Fdaf2323FC738827544eB7C91368f2BCA",
  "0xfEE47986A4B9083d7dB1829BeEd6f88A91DD4338",
  "0x4A2C55CcD180cAA7519b7D4D3eD595Ec56fA81b4",
  "0x025baf9Ba5DacE8367C70cAD0B44b728eDba5449",
  "0x770638E0cD8781DD4b64E3A4Cad06113B6eEfccA",
  "0xD20Ac7e897b8e54df47d0a491b791C33193cE535",
  "0x31bB5b1655df3CB645d17c62B96B91e01159ce2D",
  "0x2A0a9AC6D8FBcEA4c470a21862ECe3Aaef7f0C8e",
  "0x060952B3b1a3818d8917A03c43fa67bB6a15A2B2",
  "0x036a3ccEDCa822c59e57ce16F28C0C3C417359E4",
  "0x3a287BBD3D6EBB85265266Fc7Ad08138627bC2d2",
  "0x4757F4E5f76fe3369843770d1090eF4F60e7a92C",
  "0x39aE8159561a0a33168d6Df073BE3008b8A5ad73",
  "0x2e00a841F3D9aF5c1c8f931640D268144d6a8193",
  "0x2f3bE49022B5944EA3F6050a3b5B415c3f307b78",
  "0x997aD8F2dd7A46de02A4aa92336dE7513B9D78Ec",
  "0xCdE82316161446a5006D62f57A1Fb372aD148a45",
  "0xfb2ed967C27F07a883c9DD8A03B48ec883FC58b2",
  "0x84F48f7E16C4fa7aFC6C2761D22803f6601B02FB",
  "0xa649Bc7D436Aad93865D5415Aa4BA6BCA9A05c0a",
  "0xc05AD6E3DFf412497F72B38A125e187e08CD922F",
  "0x68CCD86440f58109Cd964FEC1a641ba7A6825B90",
  "0x47df9fa3D01cb82B024CEfB4E2C1aeb1e229876f",
  "0x86dd862d995147374C8Bc8d8ffedA43C50dC2e57",
  "0xa31B086125dE7C3BfafABFAF738fd1F0925B6FBB",
  "0xF5067d3FEE4D4306DD5DE03a9FE5b85de279D0CA",
  "0x1f29d1e83c9f37aB2055e3336c4e680bfF8970b0",
  "0xC1D71192BDfA2ebC99C9b982F3c7C0Fa9EF3Ac4A",
  "0x1A29d558eEeFA90E23a6224c51a79ff448609539",
  "0xe15f843480BAd6b9ce15338c7741ECD27335101F"
]);
