import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/database.types";

export type Client = SupabaseClient<Database>;

export class NotFoundError extends Error {
  constructor(entity: string, id: string) {
    super(`${entity} ${id} not found`);
    this.name = "NotFoundError";
  }
}

export function unwrap<R extends { data: unknown; error: { message: string } | null }>(
  result: R,
  what: string,
): NonNullable<R["data"]> {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  if (result.data === null || result.data === undefined) throw new Error(`${what}: no data`);
  return result.data as NonNullable<R["data"]>;
}

export function formatIsoDate(iso: string, locale = "en-US"): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeZone: "UTC" }).format(
    new Date(Date.UTC(y, m - 1, d)),
  );
}
