import fetch from "node-fetch";

const lusdCBBAMMQuery = /*sql*/ `
  with

  d as (
    select
      "timestamp",
      "block_number",
      "log_index",
      utils.HEX_TO_NUMBER(SUBSTRING("data", 3)) / 1e18 as "bamm_deposit",
      null::numeric as "bamm_raw"
    from ethereum.logs
    where
      "address" = '0x896d8a30c32ead64f2e1195c2c8e0932be7dc20b' and
      "topic_0" = '0x35db3d768e685509e031bae369804ca7dc6656af739e079f1d3312cadc7b19d8'
  ),

  w as (
    select
      b."timestamp",
      b."block_number",
      b."log_index",
      -utils.HEX_TO_NUMBER(SUBSTRING(b."data", 3)) / 1e18 as "bamm_deposit",
      case
        when s."data" is not null then
          utils.HEX_TO_NUMBER(SUBSTRING(s."data", 3)) / 1e18
        else
          null
      end as "bamm_raw"
    from (
      select * from ethereum.logs
      where
        "address" = '0x896d8a30c32ead64f2e1195c2c8e0932be7dc20b' and
        "topic_0" = '0x98824d89d47225910d3e61aa38b640d29d58b43e2dc47b4d986a588c88e0a2a8'
    ) b left join (
      select * from ethereum.logs
      where
        "address" = '0x57619fe9c539f890b19c61812226f9703ce37137' and
        "topic_0" = '0xe0ae890eaa03f699e40e47e1644539436b9871b84f64d484b069ac9e0e918914'
    ) c on (
      b."block_number"  = c."block_number" and
      b."log_index" + 3 = c."log_index"
    ) left join (
      select * from ethereum.logs
      where
        "address" = '0x66017d22b0f8556afdd19fc67041899eb65a21bb' and
        "topic_0" = '0xbce78369dccab09eec1986f4d409ab09ffbb47d65423e5148fcf98411c5111c9'
    ) s on (
      c."block_number"  = s."block_number" and
      c."log_index" - 6 = s."log_index"
    )
  ),

  s as (
    select
      "timestamp",
      "block_number",
      "log_index",
      SUM("bamm_deposit") over (order by "timestamp", "block_number", "log_index") as "bamm_deposit",
      "bamm_raw"
    from (
      select * from d where "timestamp" > NOW() - '45 days'::interval
        union all
      select * from w where "timestamp" > NOW() - '45 days'::interval
        union all
      select *, null, null, null, null from GENERATE_SERIES(
        DATE_TRUNC('hour', NOW() - '30 days'::interval),
        DATE_TRUNC('hour', NOW()),
        '1 hour'
      )
    ) u
  ),

  m as (
    select
      "timestamp",
      "block_number",
      "bamm_deposit",
      MAX("bamm_raw" - "bamm_deposit") over (order by "timestamp", "block_number", "log_index") as "bamm_offset"
    from s
  ),

  c as (
    select
      "timestamp",
      "bamm_offset",
      "bamm_deposit" + "bamm_offset" as "bamm_debt"
    from m
    where "block_number" is null
  )

  select
    "timestamp",
    "bamm_debt",

    365 / 7 * (
      "bamm_offset" - LAG("bamm_offset", 7 * 24) over (order by "timestamp")
    ) / (
      AVG("bamm_debt") over (order by "timestamp" rows between 7 * 24 - 1 preceding and current row)
    ) as "bamm_apr_7d",

    365 / 14 * (
      "bamm_offset" - LAG("bamm_offset", 14 * 24) over (order by "timestamp")
    ) / (
      AVG("bamm_debt") over (order by "timestamp" rows between 14 * 24 - 1 preceding and current row)
    ) as "bamm_apr_14d",

    365 / 30 * (
      "bamm_offset" - LAG("bamm_offset", 30 * 24) over (order by "timestamp")
    ) / (
      AVG("bamm_debt") over (order by "timestamp" rows between 30 * 24 - 1 preceding and current row)
    ) as "bamm_apr_30d"

  from c
  order by "timestamp" desc
  limit 1
`;

interface SQLQueryResponseSuccess<T extends unknown[]> {
  status: "success";
  stats: { count: number; size: number; time: number };
  results: T;
}

interface SQLQueryResponseError {
  status: "error";
  message: string;
}

const executeSQLQuery = async <T extends unknown[]>(sql: string, transposeApiKey: string) => {
  const response = await fetch("https://api.transpose.io/sql", {
    method: "POST",
    headers: {
      "X-API-Key": transposeApiKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ sql })
  });

  return response.json() as Promise<SQLQueryResponseError | SQLQueryResponseSuccess<T>>;
};

export interface LUSDCBBAMMStats {
  timestamp: string;
  bamm_debt: number;
  bamm_apr_7d: number;
  bamm_apr_14d: number;
  bamm_apr_30d: number;
}

export const fetchLUSDCBBAMMStats = async (transposeApiKey: string): Promise<LUSDCBBAMMStats> => {
  const response = await executeSQLQuery<[LUSDCBBAMMStats]>(lusdCBBAMMQuery, transposeApiKey);

  if (response.status === "error") {
    throw new Error(`fetchLUSDCBBAMMStats: query failed (${response.message})`);
  }

  console.log("fetchLUSDCBBAMMStats: query stats", response.stats);

  return response.results[0];
};
