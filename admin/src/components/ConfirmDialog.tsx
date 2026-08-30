import { useEffect, useRef, useState } from 'react';

/**
 * Confirmation dialog for destructive or audited actions.
 *
 * Replaces the native prompt()/confirm() the admin used to rely on. Those were
 * wrong on three counts: unstyled, unvalidatable, and they silently accepted an
 * empty reason on actions that are written to the audit log. Here the confirm
 * button stays disabled until the field is genuinely valid.
 */

export type DialogField =
  | { kind: 'none' }
  | { kind: 'reason'; label?: string; placeholder?: string }
  | { kind: 'number'; label: string; defaultValue?: string; min?: number; max?: number };

export interface ConfirmRequest {
  title: string;
  body?: string;
  confirmLabel: string;
  /** `critical` paints the confirm button red — for suspend, ban, refund, delete. */
  tone?: 'critical' | 'default';
  field?: DialogField;
  onConfirm: (value: string) => Promise<void> | void;
}

export default function ConfirmDialog({
  request,
  onClose,
}: {
  request: ConfirmRequest | null;
  onClose: () => void;
}) {
  const field: DialogField = request?.field ?? { kind: 'none' };
  const [value, setValue] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);

  // Reset per invocation so a previous reason never leaks into the next action.
  useEffect(() => {
    if (!request) return;
    const t = window.setTimeout(() => {
      setValue(field.kind === 'number' ? (field.defaultValue ?? '') : '');
      setError(null);
      setPending(false);
      inputRef.current?.focus();
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  useEffect(() => {
    if (!request) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !pending) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [request, pending, onClose]);

  if (!request) return null;

  const trimmed = value.trim();
  let invalid: string | null = null;
  if (field.kind === 'reason') {
    if (!trimmed) invalid = 'A reason is required — it is written to the audit log.';
  } else if (field.kind === 'number') {
    const n = Number(trimmed);
    if (!trimmed || !Number.isInteger(n)) invalid = 'Enter a whole number.';
    else if (field.min != null && n < field.min) invalid = `Must be at least ${field.min}.`;
    else if (field.max != null && n > field.max) invalid = `Must be at most ${field.max}.`;
  }
  const canConfirm = !invalid && !pending;

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!canConfirm) return;
    setPending(true);
    setError(null);
    try {
      await request.onConfirm(trimmed);
      onClose();
    } catch (err: unknown) {
      setPending(false);
      setError(
        (err as { message?: string })?.message || 'That didn’t go through. Try again.',
      );
    }
  };

  const critical = request.tone === 'critical';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !pending) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        /* No shadow — on a dark ground it either vanishes or turns into a grey
           halo. The border plus the surface step carries the elevation. */
        className="w-full max-w-md rounded-lg border border-border bg-card"
      >
        <form onSubmit={submit}>
          <div className="px-5 pt-5">
            <h2 id="confirm-title" className="text-lg font-semibold text-ink">
              {request.title}
            </h2>
            {request.body && (
              <p className="mt-1 text-sm text-ink-soft">{request.body}</p>
            )}
          </div>

          {field.kind !== 'none' && (
            <div className="px-5 pt-4">
              <label
                htmlFor="confirm-field"
                className="block text-[11px] uppercase tracking-[0.12em] text-ink-soft"
              >
                {field.kind === 'reason' ? (field.label ?? 'Reason') : field.label}
              </label>
              {field.kind === 'reason' ? (
                <textarea
                  id="confirm-field"
                  ref={inputRef as React.RefObject<HTMLTextAreaElement>}
                  rows={3}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  placeholder={field.placeholder ?? 'Why is this happening?'}
                  className="mt-2 w-full resize-none rounded-md border border-border bg-inset px-3 py-2 text-sm text-ink placeholder:text-ink-soft focus:border-gold focus:outline-none"
                />
              ) : (
                <input
                  id="confirm-field"
                  ref={inputRef as React.RefObject<HTMLInputElement>}
                  type="number"
                  inputMode="numeric"
                  min={field.min}
                  max={field.max}
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="tabular mt-2 w-full rounded-md border border-border bg-inset px-3 py-2 text-sm text-ink focus:border-gold focus:outline-none"
                />
              )}
              {/* Only nag once they've typed something — an error on an
                  untouched field reads as a scolding. */}
              {invalid && value.length > 0 && (
                <p className="mt-2 text-xs text-critical">{invalid}</p>
              )}
            </div>
          )}

          {error && (
            <p className="mx-5 mt-4 rounded-md border border-critical/40 bg-critical/15 px-3 py-2 text-xs text-critical">
              {error}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2 border-t border-border px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="rounded-md px-4 py-2 text-sm text-ink-soft hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canConfirm}
              className={`rounded-md px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-40 ${
                critical
                  ? 'bg-critical text-ground hover:bg-critical/90'
                  : 'bg-gold text-ground hover:bg-gold/90'
              }`}
            >
              {pending ? 'Working…' : request.confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
