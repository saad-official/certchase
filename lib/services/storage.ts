import "server-only";
import type { Client } from "@/lib/services/shared";

export const CERTIFICATES_BUCKET = "certificates";
export const MAX_CERTIFICATE_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg"] as const;
export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export function isAllowedMimeType(value: string): value is AllowedMimeType {
  return (ALLOWED_MIME_TYPES as readonly string[]).includes(value);
}

/** Objects live at `<org_id>/<certificate_id>/<file_name>`; RLS reads the first segment. */
export function certificateObjectPath(orgId: string, certificateId: string, fileName: string) {
  const safe = fileName.replace(/[^\w.\- ()]/g, "_").slice(0, 120) || "certificate.pdf";
  return `${orgId}/${certificateId}/${safe}`;
}

export async function uploadCertificateFile(
  client: Client,
  path: string,
  data: Uint8Array,
  mimeType: AllowedMimeType,
): Promise<void> {
  const { error } = await client.storage
    .from(CERTIFICATES_BUCKET)
    .upload(path, data, { contentType: mimeType, upsert: false });
  if (error) throw new Error(`upload certificate: ${error.message}`);
}

export async function downloadCertificateFile(client: Client, path: string): Promise<Uint8Array> {
  const { data, error } = await client.storage.from(CERTIFICATES_BUCKET).download(path);
  if (error || !data) throw new Error(`download certificate: ${error?.message ?? "no data"}`);
  return new Uint8Array(await data.arrayBuffer());
}

/** Short-lived URL for the in-app document pane. */
export async function signedCertificateUrl(client: Client, path: string, expiresInSeconds = 600): Promise<string> {
  const { data, error } = await client.storage.from(CERTIFICATES_BUCKET).createSignedUrl(path, expiresInSeconds);
  if (error || !data) throw new Error(`sign certificate url: ${error?.message ?? "no data"}`);
  return data.signedUrl;
}

export async function removeCertificateFile(client: Client, path: string): Promise<void> {
  const { error } = await client.storage.from(CERTIFICATES_BUCKET).remove([path]);
  if (error) throw new Error(`remove certificate: ${error.message}`);
}
