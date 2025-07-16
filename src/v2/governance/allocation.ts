import fs from "fs";
import path from "path";
import { OUTPUT_DIR_V2 } from "../../constants";

const SUBGRAPH_QUERY_LIMIT = 1000;

const graphql = String.raw;

type GraphQLQueryParams = {
  operationName: string;
  query: string;
  variables: Record<string, unknown>;
};

type GraphQLResponse<T> =
  | { data: T | null }
  | { data: T | null; errors: unknown[] }
  | { errors: unknown[] };

const query = async <T extends {}>(url: string, params: GraphQLQueryParams) => {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify(params)
  });

  const json: GraphQLResponse<T> = await res.json();

  if (!("data" in json) || json.data === null || "errors" in json) {
    const error = new Error("GraphQL error");

    if ("errors" in json) {
      throw Object.assign(error, { errors: json.errors });
    } else {
      throw error;
    }
  }

  return json.data;
};

const queryAllocations = graphql`
  query Allocations($epoch: BigInt!, $cursor: ID!, $limit: Int) {
    governanceAllocations(where: { epoch: $epoch, id_gt: $cursor }, orderBy: id, first: $limit) {
      id
      user
      initiative {
        id
      }
      voteLQTY
      vetoLQTY
      voteOffset
      vetoOffset
    }
  }
`;

interface Allocation {
  id: string;
  user: string | null;
  initiative: {
    id: string;
  };
  voteLQTY: string;
  vetoLQTY: string;
  voteOffset: string;
  vetoOffset: string;
}

interface Allocations {
  governanceAllocations: Allocation[];
}

interface AllocationJson {
  initiative?: string;
  epoch: number;
  voteLQTY: string;
  vetoLQTY: string;
  voteOffset: string;
  vetoOffset: string;
}

const getAllocationsInEpoch = async (subgraphUrl: string, epoch: number) => {
  const allocations: Allocation[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<Allocations>(subgraphUrl, {
      operationName: "Allocations",
      query: queryAllocations,
      variables: {
        epoch,
        cursor,
        limit: SUBGRAPH_QUERY_LIMIT
      }
    });

    allocations.push(...result.governanceAllocations);
    if (result.governanceAllocations.length < SUBGRAPH_QUERY_LIMIT) break;
    cursor = allocations[allocations.length - 1].id;
  }

  return allocations;
};

const allocationDir = path.join(OUTPUT_DIR_V2, "governance", "allocation");
const userDir = path.join(allocationDir, "user");
const totalDir = path.join(allocationDir, "total");

export const snapshotEpoch = async (subgraphUrl: string, epoch: number) => {
  const allocations = await getAllocationsInEpoch(subgraphUrl, epoch);
  const updates = new Map<string, AllocationJson[]>();

  for (const { id, user, initiative, ...allocation } of allocations) {
    const fileName =
      user !== null
        ? path.join(userDir, `${user}.json`)
        : path.join(totalDir, `${initiative.id}.json`);

    let newAllocations = updates.get(fileName);
    if (!newAllocations) {
      newAllocations = [];
      updates.set(fileName, newAllocations);
    }

    newAllocations.push({
      epoch,
      ...(user !== null ? { initiative: initiative.id } : {}),
      ...allocation
    });
  }

  for (const [fileName, newAllocations] of updates.entries()) {
    let allocations: AllocationJson[];

    if (fs.existsSync(fileName)) {
      allocations = JSON.parse(fs.readFileSync(fileName, "utf-8"));
      allocations = allocations.filter(allocation => allocation.epoch !== epoch);
    } else {
      allocations = [];
      fs.mkdirSync(path.dirname(fileName), { recursive: true });
    }

    allocations.push(...newAllocations);
    allocations.sort((a, b) => {
      const epochCmp = a.epoch - b.epoch;
      return epochCmp == 0 ? a.initiative!.localeCompare(b.initiative!) : epochCmp;
    });

    fs.writeFileSync(fileName, JSON.stringify(allocations, null, 2));
  }
};
