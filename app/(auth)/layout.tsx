import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="drafting-grid flex min-h-svh flex-1 flex-col bg-background lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <aside className="relative hidden flex-col justify-between bg-graphite p-12 text-bone lg:flex">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-2xl font-semibold tracking-tight text-bone outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          <span aria-hidden className="inline-block size-3 bg-cobalt" />
          CertChase
        </Link>
        <div className="max-w-md space-y-4">
          <p className="text-4xl font-semibold leading-tight tracking-tight">
            Certificates of insurance, tracked and chased.
          </p>
          <p className="text-sm text-bone/70">
            CertChase reads each certificate, checks it against what your contract requires
            using plain rules, and drafts the broker follow-ups for your approval.
          </p>
          <dl className="grid grid-cols-3 gap-3 pt-2 font-mono text-xs text-bone/70">
            <div>
              <dt className="text-bone/50">Extracts</dt>
              <dd>vision model</dd>
            </div>
            <div>
              <dt className="text-bone/50">Decides</dt>
              <dd>rule engine</dd>
            </div>
            <div>
              <dt className="text-bone/50">Approves</dt>
              <dd>you</dd>
            </div>
          </dl>
        </div>
        <p className="text-xs text-bone/50">For small contractors, property managers and venues.</p>
      </aside>

      <div className="flex flex-1 flex-col px-4 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <Link href="/" className="text-xl font-semibold tracking-tight lg:invisible">
            CertChase
          </Link>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <ArrowLeft className="size-4" aria-hidden />
            Back to home
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm rounded-lg bg-background/80 backdrop-blur-sm">{children}</div>
        </main>
      </div>
    </div>
  );
}
