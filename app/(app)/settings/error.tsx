"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function SettingsError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <section
      role="alert"
      className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed bg-card/60 px-6 py-14 text-center"
    >
      <h2 className="text-xl">Settings didn&rsquo;t load.</h2>
      <p className="max-w-md text-sm text-muted-foreground">
        Nothing was changed. Try again; if it keeps happening, check the server logs.
        {error.digest ? (
          <>
            {" "}
            Reference <span className="data text-xs">{error.digest}</span>.
          </>
        ) : null}
      </p>
      <Button variant="outline" className="mt-2" onClick={() => retry()}>
        Try again
      </Button>
    </section>
  );
}
