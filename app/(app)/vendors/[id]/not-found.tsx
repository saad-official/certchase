import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function VendorNotFound() {
  return (
    <EmptyState
      title="Vendor not found"
      description="It may have been removed with the demo vendors, or it belongs to another organization."
      action={
        <Button asChild>
          <Link href="/vendors">Back to vendors</Link>
        </Button>
      }
    />
  );
}
