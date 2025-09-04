import util from "util";
import { z } from "zod";

export const zTypeGuard =
  <T extends z.ZodType>(schema: T) =>
  (data: unknown): data is z.infer<T> =>
    schema.safeParse(data).success;

export const zDuneResponse = <T extends z.ZodType>(rowSchema: T) =>
  z.object({
    result: z.object({
      rows: z.array(rowSchema)
    })
  });

export const DuneUnknownResponse = zDuneResponse(z.unknown());
export type DuneUnknownResponse = z.infer<typeof DuneUnknownResponse>;

export const duneFetch = async <T extends DuneUnknownResponse>({
  apiKey,
  url,
  validate
}: {
  apiKey: string;
  url: string;
  validate: (data: unknown) => data is T;
}): Promise<T> => {
  const response = await fetch(url, {
    headers: { "X-Dune-API-Key": apiKey }
  });
  const data = await response.json();

  console.log(`Dune response for ${url}:`, util.inspect(data, { colors: true, depth: null }));

  if (!validate(data)) {
    throw new Error("Dune query returned unexpected response");
  }

  return data;
};
