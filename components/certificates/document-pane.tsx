import { ExternalLink, FileWarning } from "lucide-react";
import { formatBytes } from "@/components/vendors/format";

/** Right-hand pane: the stored document, through a short-lived signed URL. */
export function DocumentPane({
  url,
  mimeType,
  fileName,
  sizeBytes,
}: {
  url: string | null;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
}) {
  return (
    <section
      aria-label="Certificate document"
      className="flex h-[75svh] flex-col overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10 lg:sticky lg:top-6 lg:h-[calc(100svh-3rem)] lg:self-start"
    >
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <p className="min-w-0 truncate text-xs">
          <span className="data">{fileName}</span>{" "}
          <span className="text-muted-foreground">· {formatBytes(sizeBytes)}</span>
        </p>
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-cobalt hover:underline"
          >
            Open
            <ExternalLink className="size-3.5" aria-hidden />
          </a>
        ) : null}
      </header>
      <div className="min-h-0 flex-1 bg-muted/40">
        {!url ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
            <FileWarning className="size-6" aria-hidden />
            The document could not be loaded from storage.
          </div>
        ) : mimeType === "application/pdf" ? (
          <iframe src={`${url}#view=FitH`} title={`Certificate ${fileName}`} className="size-full border-0" />
        ) : (
          <div className="size-full overflow-auto p-3">
            {/* Signed Storage URLs are short-lived and off-origin; next/image would need remotePatterns. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Certificate ${fileName}`} className="mx-auto h-auto max-w-full bg-white shadow-card" />
          </div>
        )}
      </div>
    </section>
  );
}
