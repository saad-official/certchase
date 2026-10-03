"use client";

import { RouteError } from "@/components/vendors/route-error";

export default function VendorError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <RouteError error={error} retry={retry} title="This vendor didn't load" backHref="/vendors" backLabel="Back to vendors" />;
}
