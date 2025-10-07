import fs from "fs";
import path from "path";
import type { Provider } from "@ethersproject/abstract-provider";
import { Contract } from "@ethersproject/contracts";
import { CallFailedError } from "../../BatchedProvider";
import { OUTPUT_DIR_V2 } from "../../constants";
import { SUBGRAPH_QUERY_LIMIT, graphql, query } from "./graphql";

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

const bribeInitiativeAbi = [
  "function bribeToken() view returns (address)"
];

const getAllInitiatives = async (subgraphUrl: string): Promise<Initiative[]> => {
  const initiatives: Initiative[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<InitiativesResponse>(subgraphUrl, {
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

const checkBribeInitiatives = async (
  provider: Provider,
  initiatives: string[]
): Promise<Map<string, { isBribe: boolean; token: string | null }>> => {
  const results = new Map<string, { isBribe: boolean; token: string | null }>();

  const checks = await Promise.allSettled(
    initiatives.map(async address => {
      try {
        const contract = new Contract(address, bribeInitiativeAbi, provider);
        const token = await contract.bribeToken();
        return { address, isBribe: true, token };
      } catch (error) {
        if (error instanceof CallFailedError) {
          return { address, isBribe: false, token: null };
        }
        throw error;
      }
    })
  );

  checks.forEach(result => {
    if (result.status === 'fulfilled') {
      results.set(result.value.address, {
        isBribe: result.value.isBribe,
        token: result.value.token
      });
    } else {
      throw result.reason;
    }
  });

  return results;
};

export const fetchInitiatives = async (
  subgraphUrl: string,
  provider: Provider
): Promise<InitiativeData[]> => {
  const initiatives = await getAllInitiatives(subgraphUrl);

  if (initiatives.length === 0) {
    return [];
  }

  const addresses = initiatives.map(i => i.id);
  const bribeInfo = await checkBribeInitiatives(provider, addresses);

  const initiativeData: InitiativeData[] = initiatives.map(initiative => {
    const info = bribeInfo.get(initiative.id) || { isBribe: false, token: null };
    return {
      address: initiative.id,
      isBribeInitiative: info.isBribe,
      bribeToken: info.token
    };
  });

  return initiativeData;
};

export const saveInitiativesToGovernance = async (
  initiatives: InitiativeData[]
): Promise<void> => {
  const governanceDir = path.join(OUTPUT_DIR_V2, "governance");
  fs.mkdirSync(governanceDir, { recursive: true });

  const filePath = path.join(governanceDir, "initiatives.json");

  fs.writeFileSync(filePath, JSON.stringify(initiatives, null, 2));
};

export const snapshotInitiatives = async (
  subgraphUrl: string,
  provider: Provider
): Promise<void> => {
  const initiatives = await fetchInitiatives(subgraphUrl, provider);
  await saveInitiativesToGovernance(initiatives);
};