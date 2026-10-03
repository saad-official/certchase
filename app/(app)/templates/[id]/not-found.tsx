import Link from "next/link";
import { EmptyState } from "@/components/app/empty-state";
import { Button } from "@/components/ui/button";

export default function TemplateNotFound() {
  return (
    <EmptyState
      title="Template not found"
      description="It may have been deleted, or it belongs to another organization."
      action={
        <Button asChild>
          <Link href="/templates">Back to requirements</Link>
        </Button>
      }
    />
  );
}
