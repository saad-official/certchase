"use client";

import { RouteError } from "@/components/vendors/route-error";

export default function TemplateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="This template didn't load" backHref="/templates" backLabel="Back to requirements" />;
}
