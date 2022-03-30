import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";

export class LQTYCirculatingSupplyPoller {
  private readonly _liquity;

  private _latestCirculatingSupply?: Decimal;
  private _latestBlockTag?: number;

  constructor(liquity: EthersLiquity | Promise<EthersLiquity>) {
    this._liquity = liquity;
  }

  async start(): Promise<void> {
    const liquity = await this._liquity;
    const provider = liquity.connection.provider;

    this._latestCirculatingSupply = await fetchLQTYCirculatingSupply(liquity);

    provider.on("block", async (blockTag: number) => {
      const supply = await fetchLQTYCirculatingSupply(liquity, blockTag);

      if (this._latestBlockTag === undefined || blockTag > this._latestBlockTag) {
        this._latestCirculatingSupply = supply;
        this._latestBlockTag = blockTag;
      }
    });
  }

  get latestCirculatingSupply(): Decimal {
    if (this._latestCirculatingSupply === undefined) {
      throw new Error("Premature call (wait for start() to resolve first)");
    }

    return this._latestCirculatingSupply;
  }
}
