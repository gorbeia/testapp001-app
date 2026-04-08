import { AccessDenied } from "@/components/AccessDenied";
import { ErrorDisplay } from "@/components/ErrorDisplay";
import { ErrorDisplay as ErrorDisplayCard } from "@/components/ErrorBoundary";
import { isHttpForbidden } from "@/lib/http-error";

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}

/**
 * For query / page errors: shows {@link AccessDenied} when the API returned HTTP 403;
 * otherwise shows the standard error UI with retry.
 */
export function AccessDeniedOrError({
  error,
  onRetry,
  className,
  cardLayout = false,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  /** Inventory-style pages use the Card layout from ErrorBoundary */
  cardLayout?: boolean;
}) {
  const err = toError(error);
  if (isHttpForbidden(err)) {
    return <AccessDenied className={className} />;
  }
  if (cardLayout) {
    return <ErrorDisplayCard error={err} />;
  }
  return <ErrorDisplay error={err} onRetry={onRetry} className={className} />;
}
