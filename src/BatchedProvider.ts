import assert from "assert";
import { Contract } from "@ethersproject/contracts";
import { BaseProvider } from "@ethersproject/providers";

import type { TransactionRequest, BlockTag } from "@ethersproject/abstract-provider";
import type { BigNumber } from "@ethersproject/bignumber";
import type { BytesLike } from "@ethersproject/bytes";
import type { Network } from "@ethersproject/networks";

export class CallFailedError extends Error {
  readonly call: unknown;
  readonly returnData: string;

  constructor(call: unknown, returnData: string) {
    super("Call failed");
    this.name = "CallFailedError";
    this.call = call;
    this.returnData = returnData;
  }
}

const multicallAddress = {
  1: "0xcA11bde05977b3631167028862bE2a173976CA11",
  14: "0xcA11bde05977b3631167028862bE2a173976CA11",
  11155111: "0xcA11bde05977b3631167028862bE2a173976CA11"
};

const hasMulticall = (chainId: number): chainId is keyof typeof multicallAddress =>
  chainId in multicallAddress;

const multicallAbi = [
  {
    type: "function",
    name: "aggregate3",
    inputs: [
      {
        type: "tuple[]",
        name: "calls",
        components: [
          {
            type: "address",
            name: "target"
          },
          {
            type: "bool",
            name: "allowFailure"
          },
          {
            type: "bytes",
            name: "callData"
          }
        ]
      }
    ],
    stateMutability: "payable",
    outputs: [
      {
        type: "tuple[]",
        name: "returnData",
        components: [
          {
            type: "bool",
            name: "success"
          },
          {
            type: "bytes",
            name: "returnData"
          }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "getEthBalance",
    inputs: [
      {
        type: "address",
        name: "addr"
      }
    ],
    stateMutability: "view",
    outputs: [
      {
        type: "uint256",
        name: "balance"
      }
    ]
  }
];

type Call3 = {
  target: string;
  allowFailure: boolean;
  callData: BytesLike;
};

type Result = {
  success: boolean;
  returnData: string;
};

type BatchableOverrides = { blockTag?: BlockTag };

interface Multicall extends Contract {
  readonly callStatic: {
    aggregate3(calls: Call3[], overrides?: BatchableOverrides): Promise<Result[]>;
  };

  getEthBalance(addr: string, overrides?: BatchableOverrides): Promise<BigNumber>;
}

interface BatchedCalls {
  blockTag: BlockTag;
  calls: Call3[];
  callbacks: [resolve: (value: string) => void, reject: (reason: unknown) => void][];
}

const emptyBatch = (): BatchedCalls => ({ blockTag: "latest", calls: [], callbacks: [] });

const batchableCall = (transaction: TransactionRequest) =>
  transaction.from === undefined &&
  transaction.gasLimit === undefined &&
  transaction.gasPrice === undefined &&
  transaction.value === undefined;

const batchedCall = (transaction: TransactionRequest, multicallAddress: string) =>
  transaction.to === multicallAddress &&
  typeof transaction.data === "string" &&
  transaction.data.startsWith("0x82ad56cb"); // signature of `aggregate3((address,bool,bytes)[])`

interface CallParams {
  transaction: TransactionRequest;
  blockTag: BlockTag;
}

interface GetBalanceParams {
  address: string;
  blockTag: BlockTag;
}

export class BatchedProvider extends BaseProvider {
  readonly underlyingProvider;
  readonly batchingDelayMs;

  #debugLog = false;

  #multicall?: Multicall;
  #timeoutId?: ReturnType<typeof setTimeout>;
  #batched: BatchedCalls = emptyBatch();

  #numberOfBatchedCalls = 0;
  #numberOfActualCalls = 0;
  #timeOfLastRatioCheck?: number;

  constructor(underlyingProvider: BaseProvider, network: Network, batchingDelayMs = 10) {
    super(network);

    this.underlyingProvider = underlyingProvider;
    this.batchingDelayMs = batchingDelayMs;

    if (hasMulticall(network.chainId)) {
      this.#multicall = new Contract(
        multicallAddress[network.chainId],
        multicallAbi,
        this
      ) as Multicall;
    }
  }

  async #dispatchCalls() {
    const { calls, callbacks, blockTag } = this.#batched;
    this.#batched = emptyBatch();

    assert(this.#multicall);

    try {
      const results = await this.#multicall.callStatic.aggregate3(calls, { blockTag });

      callbacks.forEach(([resolve, reject], i) => {
        if (results[i].success) {
          resolve(results[i].returnData);
        } else {
          reject(new CallFailedError(calls[i], results[i].returnData));
        }
      });
    } catch (error) {
      callbacks.forEach(([, reject]) => reject(error));
    }
  }

  #enqueueCall(call: Call3): Promise<string> {
    if (this.#timeoutId !== undefined) {
      clearTimeout(this.#timeoutId);
    }

    this.#batched.calls.push(call);
    this.#timeoutId = setTimeout(() => this.#dispatchCalls(), this.batchingDelayMs);

    return new Promise((resolve, reject) => this.#batched.callbacks.push([resolve, reject]));
  }

  #alreadyBatchedCallsConflictWith(blockTag: BlockTag) {
    return this.#batched.calls.length !== 0 && blockTag !== this.#batched.blockTag;
  }

  #checkBatchingRatio() {
    const now = new Date().getTime();

    if (this.#timeOfLastRatioCheck === undefined) {
      this.#timeOfLastRatioCheck = now;
    } else {
      const timeSinceLastRatioCheck = now - this.#timeOfLastRatioCheck;

      if (timeSinceLastRatioCheck >= 10000 && this.#numberOfActualCalls) {
        if (this.#debugLog) {
          console.log(
            `Call batching ratio: ${
              Math.round((10 * this.#numberOfBatchedCalls) / this.#numberOfActualCalls) / 10
            }X`
          );
        }

        this.#numberOfBatchedCalls = 0;
        this.#numberOfActualCalls = 0;
        this.#timeOfLastRatioCheck = now;
      }
    }
  }

  async #performCall(params: CallParams): Promise<string> {
    if (!this.#multicall) {
      return this.underlyingProvider.perform("call", params);
    }

    this.#checkBatchingRatio();

    if (
      batchedCall(params.transaction, this.#multicall.address) ||
      !batchableCall(params.transaction) ||
      this.#alreadyBatchedCallsConflictWith(params.blockTag)
    ) {
      this.#numberOfActualCalls++;

      return this.underlyingProvider.perform("call", params);
    } else {
      this.#numberOfBatchedCalls++;

      if (this.#batched.calls.length === 0) {
        this.#batched.blockTag = params.blockTag;
      }

      assert(params.transaction.to !== undefined);
      assert(params.transaction.data !== undefined);

      return this.#enqueueCall({
        target: params.transaction.to,
        allowFailure: true,
        callData: params.transaction.data
      });
    }
  }

  async #performGetBalance(params: GetBalanceParams): Promise<BigNumber> {
    if (!this.#multicall) {
      return this.underlyingProvider.perform("getBalance", params);
    }

    return this.#multicall.getEthBalance(params.address, { blockTag: params.blockTag });
  }

  async perform(method: string, params: unknown): Promise<unknown> {
    switch (method) {
      case "call":
        return this.#performCall(params as CallParams);
      case "getBalance":
        return this.#performGetBalance(params as GetBalanceParams);
      default:
        return this.underlyingProvider.perform(method, params);
    }
  }

  detectNetwork(): Promise<Network> {
    return this.underlyingProvider.detectNetwork();
  }
}
