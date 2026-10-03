/**
 * Minimal, plain email shell for chase messages. The agent produces subject
 * and body as text; this adds a readable HTML version and a footer naming
 * the sending business.
 */
export type ChaseEmailInput = {
  subject: string;
  body: string;
  businessName: string;
  /** Optional link to a requirements sheet or upload page. */
  actionUrl?: string | null;
  actionLabel?: string | null;
};

export type RenderedEmail = { subject: string; text: string; html: string };

export function renderChaseEmail(input: ChaseEmailInput): RenderedEmail {
  const text = [input.body.trim(), input.actionUrl ? `\n${input.actionLabel ?? "Upload the certificate"}: ${input.actionUrl}` : ""]
    .join("\n")
    .trim();

  const paragraphs = input.body
    .trim()
    .split(/\n{2,}/)
    .map((block) => {
      const lines = block.split("\n");
      if (lines.every((l) => l.trim().startsWith("- "))) {
        return `<ul style="margin:0 0 14px;padding-left:20px">${lines
          .map((l) => `<li style="margin:0 0 4px">${escapeHtml(l.trim().slice(2))}</li>`)
          .join("")}</ul>`;
      }
      return `<p style="margin:0 0 14px">${escapeHtml(block).replaceAll("\n", "<br>")}</p>`;
    })
    .join("");

  const html = `<!doctype html>
<html lang="en">
<body style="margin:0;background:#F6F4EF;padding:24px 12px;font:15px/1.55 'IBM Plex Sans',-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1F2328">
  <div style="max-width:580px;margin:0 auto;background:#fff;border:1px solid #E2DED5;border-radius:6px;padding:28px">
    ${paragraphs}
    ${
      input.actionUrl
        ? `<p style="margin:18px 0 0"><a href="${escapeHtml(input.actionUrl)}" style="display:inline-block;background:#2458E6;color:#fff;text-decoration:none;padding:10px 16px;border-radius:6px;font-weight:600">${escapeHtml(input.actionLabel ?? "Upload the certificate")}</a></p>`
        : ""
    }
  </div>
  <p style="max-width:580px;margin:14px auto 0;font-size:12px;color:#5B6470;text-align:center">Sent on behalf of ${escapeHtml(input.businessName)}.</p>
</body>
</html>`;

  return { subject: input.subject, text, html };
}

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
