import fs from "fs";
import path from "path";
import type { Provider } from "@ethersproject/abstract-provider";
import { type BaseContract, type CallOverrides, Contract } from "@ethersproject/contracts";
import { CallFailedError } from "../../BatchedProvider";
import { OUTPUT_DIR_V2 } from "../../constants";
import { SUBGRAPH_QUERY_LIMIT, graphql, query } from "./graphql";

export interface SnapshotInitiativesParams {
  subgraphUrl: string;
  subgraphOrigin?: string;
  provider: Provider;
}

const queryInitiatives = graphql`
  query Initiatives($cursor: ID!, $limit: Int) {
    governanceInitiatives(where: { id_gt: $cursor }, orderBy: id, first: $limit) {
      id
    }
  }
`;

interface Initiative {
  id: string;
}

interface InitiativesResponse {
  governanceInitiatives: Initiative[];
}

export interface InitiativeData {
  address: string;
  isBribeInitiative: boolean;
  bribeToken: string | null;
}

const bribeInitiativeAbi = ["function bribeToken() view returns (address)"];

interface BribeInitiative extends BaseContract {
  bribeToken(overrides?: CallOverrides): Promise<string>;
}

const getAllInitiatives = async (
  subgraphUrl: string,
  subgraphOrigin?: string
): Promise<Initiative[]> => {
  const initiatives: Initiative[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<InitiativesResponse>(subgraphUrl, {
      origin: subgraphOrigin,
      operationName: "Initiatives",
      query: queryInitiatives,
      variables: {
        cursor,
        limit: SUBGRAPH_QUERY_LIMIT
      }
    });

    initiatives.push(...result.governanceInitiatives);
    if (result.governanceInitiatives.length < SUBGRAPH_QUERY_LIMIT) break;
    cursor = initiatives[initiatives.length - 1].id;
  }

  return initiatives;
};

const checkBribeInitiatives = (
  provider: Provider,
  initiatives: string[]
): Promise<InitiativeData[]> =>
  Promise.all(
    initiatives.map(async address => {
      try {
        const contract = new Contract(address, bribeInitiativeAbi, provider) as BribeInitiative;
        const bribeToken = await contract.bribeToken();
        return { address, isBribeInitiative: true, bribeToken };
      } catch (error) {
        if (
          error instanceof CallFailedError ||
          // The initiative `0xA7e5d44349E3342cd6F323dE3E6C33B249c9Df38`
          // (which is just an EOA) is returning success, but no `bribeToken`
          // address, which results in a decoding failure in ethers.js
          (error instanceof Error && "code" in error && error.code === "CALL_EXCEPTION")
        ) {
          return { address, isBribeInitiative: false, bribeToken: null };
        }
        throw error;
      }
    })
  );

export const fetchInitiatives = async (
  params: SnapshotInitiativesParams
): Promise<InitiativeData[]> => {
  const initiatives = await getAllInitiatives(params.subgraphUrl, params.subgraphOrigin);

  if (initiatives.length === 0) {
    return [];
  }

  const addresses = initiatives.map(i => i.id);
  return checkBribeInitiatives(params.provider, addresses);
};

export const saveInitiativesToGovernance = async (initiatives: InitiativeData[]): Promise<void> => {
  const governanceDir = path.join(OUTPUT_DIR_V2, "governance");
  fs.mkdirSync(governanceDir, { recursive: true });

  const filePath = path.join(governanceDir, "initiatives.json");

  fs.writeFileSync(filePath, JSON.stringify(initiatives, null, 2));
};

export const snapshotInitiatives = async (params: SnapshotInitiativesParams): Promise<void> => {
  const initiatives = await fetchInitiatives(params);
  await saveInitiativesToGovernance(initiatives);
};
