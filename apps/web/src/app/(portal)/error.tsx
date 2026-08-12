"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/feedback/PageState";

export default function PortalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="Something went wrong"
      message="The page could not be loaded. Please try again."
      onRetry={() => reset()}
    />
  );
}
