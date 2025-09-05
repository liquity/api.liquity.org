export const extractLink = (htmlLink?: string | null) =>
  htmlLink?.match(/href=(?:"|')?([^"'\s>]+)/i)?.[1] ?? null;
