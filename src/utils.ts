import { Dnum } from "dnum";

export function dnum18(value: null | undefined): null;
export function dnum18(value: string | bigint | number): Dnum;
export function dnum18(value: string | bigint | number | null | undefined): Dnum | null;
export function dnum18(value: string | bigint | number | null | undefined): Dnum | null {
  return value === undefined || value === null ? null : [BigInt(value), 18];
}
