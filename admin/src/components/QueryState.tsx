/**
 * The two states every list in this console needs and mostly didn't have.
 *
 * Before this, pages did `.catch(console.error)` and rendered nothing, so a
 * failed request was indistinguishable from "there is no data" — the single
 * most misleading thing an ops tool can do.
 */

function Glyph({ path }: { path: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-6 h-6"
      aria-hidden="true"
    >
      <path d={path} />
    </svg>
  );
}

/** Visible, retryable. Never a silent console log. */
export function ErrorNotice({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-lg border border-critical/40 bg-critical/10 p-5">
      <div className="flex items-start gap-3">
        <span className="text-critical mt-0.5">
          <Glyph path="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
        </span>
        <div className="flex-1">
          <p className="text-sm font-semibold text-critical">This didn’t load.</p>
          <p className="mt-1 text-sm text-ink-soft">{message}</p>
          {onRetry && (
            <button
              onClick={onRetry}
              className="mt-3 rounded-md bg-gold px-4 py-2 text-sm font-semibold text-ground hover:bg-gold/90"
            >
              Try again
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * An empty screen is an invitation, not a scolding — house style from
 * mobile/artifacts/mobile/constants/voice.ts, in the admin's drier register.
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-6 py-12 text-center">
      <span className="inline-flex text-ink-faint">
        <Glyph path="M3 7h18M3 12h18M3 17h9" />
      </span>
      <p className="mt-3 text-sm font-semibold text-ink">{title}</p>
      {body && <p className="mt-1 text-sm text-ink-soft">{body}</p>}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 rounded-md border border-border px-4 py-2 text-sm text-ink-soft hover:text-ink hover:bg-inset"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
