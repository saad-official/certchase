import Link from "next/link";
import { cn } from "@/lib/utils";
import { focusRing } from "./site";

/** Cobalt square mark plus the name. The square is the same mark as a status chip's leading square. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2.5", focusRing, className)}>
      <span aria-hidden="true" className="size-3.5 shrink-0 bg-cobalt" />
      <span className="font-sans text-[1.0625rem] leading-none font-semibold tracking-[-0.01em]">CertChase</span>
    </Link>
  );
}
