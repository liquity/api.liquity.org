import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

import { fetchLQTYCirculatingSupply } from "./fetchLQTYCirculatingSupply";

export class LQTYCirculatingSupplyPoller {
  private readonly _liquity: EthersLiquity | Promise<EthersLiquity>;
  private readonly _excludedAddresses: readonly string[];

  private _latestCirculatingSupply?: Decimal;
  private _latestBlockTag?: number;

  constructor(
    liquity: EthersLiquity | Promise<EthersLiquity>,
    excludedAddresses: readonly string[]
  ) {
    this._liquity = liquity;
    this._excludedAddresses = excludedAddresses;
  }

  async start(): Promise<void> {
    const liquity = await this._liquity;

    this._latestCirculatingSupply = await fetchLQTYCirculatingSupply(
      liquity,
      this._excludedAddresses
    );

    liquity.connection.provider.on("block", async (blockTag: number) => {
      const supply = await fetchLQTYCirculatingSupply(liquity, this._excludedAddresses, blockTag);

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
