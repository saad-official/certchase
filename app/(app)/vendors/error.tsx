"use client";

import { RouteError } from "@/components/vendors/route-error";

export default function VendorsError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="Vendors didn't load" backHref="/dashboard" backLabel="Go to dashboard" />;
}
