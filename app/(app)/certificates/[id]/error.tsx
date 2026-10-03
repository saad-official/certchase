"use client";

import { RouteError } from "@/components/vendors/route-error";

export default function CertificateError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="This certificate didn't load" backHref="/certificates" backLabel="Back to certificates" />;
}
