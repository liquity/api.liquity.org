import fs from "fs";
import path from "path";
import { OUTPUT_DIR_V2_GOVERNANCE } from "../../constants";
import { SUBGRAPH_QUERY_LIMIT, graphql, query } from "./graphql";

export interface SnapshotEpochParams {
  subgraphUrl: string;
  subgraphOrigin?: string;
  epoch: number;
}

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

const getAllocationsInEpoch = async (params: SnapshotEpochParams) => {
  const allocations: Allocation[] = [];
  let cursor = "";

  for (;;) {
    const result = await query<Allocations>(params.subgraphUrl, {
      origin: params.subgraphOrigin,
      operationName: "Allocations",
      query: queryAllocations,
      variables: {
        epoch: params.epoch,
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

const allocationDir = path.join(OUTPUT_DIR_V2_GOVERNANCE, "allocation");
const userDir = path.join(allocationDir, "user");
const totalDir = path.join(allocationDir, "total");
const latestCompletedEpochFile = path.join(OUTPUT_DIR_V2_GOVERNANCE, "latest_completed_epoch.json");

export const snapshotEpoch = async (params: SnapshotEpochParams) => {
  const { epoch } = params;
  const allocations = await getAllocationsInEpoch(params);
  const updates = new Map<string, AllocationJson[]>();

  for (const { user, initiative, vetoLQTY, vetoOffset, voteLQTY, voteOffset } of allocations) {
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
      vetoLQTY,
      vetoOffset,
      voteLQTY,
      voteOffset
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

    const prevLatestCompletedEpoch: number = JSON.parse(
      fs.readFileSync(latestCompletedEpochFile, "utf-8")
    );

    if (epoch > prevLatestCompletedEpoch) {
      fs.writeFileSync(latestCompletedEpochFile, JSON.stringify(epoch));
    }
  }
};
