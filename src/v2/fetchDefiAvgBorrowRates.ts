import { z } from "zod";
import fs from "fs";
import util from "util";
import { DEFI_AVG_BORROW_RATES_FILE } from "../constants";

const readFile = util.promisify(fs.readFile);

const zDefiAvgBorrowRates = z.array(
  z.object({
    collateral: z.string(),
    defi_avg_borrow_rate: z.number()
  })
);

// TODO fetch the data from an external API
export const fetchDefiAvgBorrowRates = async () =>
  zDefiAvgBorrowRates.parse(JSON.parse(await readFile(DEFI_AVG_BORROW_RATES_FILE, "utf-8")));
