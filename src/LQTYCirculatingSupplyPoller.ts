import { Decimal } from "@liquity/lib-base";
import { EthersLiquity } from "@liquity/lib-ethers";

const TOTAL_SUPPLY = Decimal.from(100e6);

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

  private async _fetchCirculatingSupply(
    liquity: EthersLiquity,
    blockTag?: number
  ): Promise<Decimal> {
    const lockedLQTY = await Promise.all(
      this._excludedAddresses.map(address => liquity.getLQTYBalance(address, { blockTag }))
    );

    return lockedLQTY.reduce((a, b) => a.sub(b), TOTAL_SUPPLY);
  }

  async start(): Promise<void> {
    const liquity = await this._liquity;

    this._latestCirculatingSupply = await this._fetchCirculatingSupply(liquity);

    liquity.connection.provider.on("block", async (blockTag: number) => {
      const supply = await this._fetchCirculatingSupply(liquity, blockTag);

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
