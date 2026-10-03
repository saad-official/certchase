import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function CertificateNotFound() {
  return (
    <EmptyState
      title="Certificate not found"
      description="It may have been removed with its vendor, or it belongs to another organization."
      action={
        <Button asChild>
          <Link href="/certificates">Back to certificates</Link>
        </Button>
      }
    />
  );
}
