import { ListSkeleton } from "@/components/vendors/list-skeleton";

export default function TemplatesLoading() {
  return <ListSkeleton label="Loading requirement templates" rows={3} />;
}
