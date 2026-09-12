import { useEffect, useState } from 'react';
import { decideIdentity, getErrorMessage, getIdentityDetail, getIdentityImage, getIdentityQueue } from '../lib/api';
import type { IdentityQueue, IdentitySlot, IdentityStatus, IdentityVerification } from '../lib/api';

const STATUS_LABEL: Record<IdentityStatus, string> = { pending_review: 'Pending review', approved: 'Approved', rejected: 'Rejected' };
const DOCUMENT_LABEL = { drivers_license: 'Driver’s license', state_id: 'State ID', passport: 'Passport' };
const SLOTS: { slot: IdentitySlot; label: string }[] = [{ slot: 'id_front', label: 'ID front' }, { slot: 'id_back', label: 'ID back' }, { slot: 'selfie', label: 'Selfie' }];
const control = 'rounded-lg border border-border bg-inset px-3 py-2 text-sm text-ink disabled:opacity-50';
const date = (value: string) => new Date(value).toLocaleString();

function PrivateImage({ id, slot, label }: { id: string; slot: IdentitySlot; label: string }) {
  const [url, setUrl] = useState<string>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    let objectUrl: string | undefined;
    getIdentityImage(id, slot, abort.signal).then(blob => {
      if (abort.signal.aborted) return;
      objectUrl = URL.createObjectURL(blob);
      setUrl(objectUrl);
      setError('');
    }).catch((e: unknown) => {
      if (!abort.signal.aborted) setError(getErrorMessage(e, 'Image unavailable.'));
    });
    return () => { abort.abort(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [id, slot, retry]);
  return <figure className="min-w-0 rounded-xl border border-border bg-inset p-3">
    <figcaption className="mb-2 text-sm font-semibold text-ink">{label}</figcaption>
    {url ? <a href={url} target="_blank" rel="noreferrer" aria-label={`Enlarge ${label.toLowerCase()}`}>
      <img src={url} alt={label} className="h-60 w-full rounded-lg object-contain" />
      <span className="mt-2 block text-center text-xs text-ink-soft">Open full size ↗</span>
    </a> : error ? <div role="alert" className="flex h-60 flex-col items-center justify-center gap-3 text-sm text-critical">
      <p>{error}</p><button className={control} onClick={() => setRetry(n => n + 1)}>Retry image</button>
    </div> : <div role="status" className="flex h-60 items-center justify-center text-sm text-ink-soft">Loading image…</div>}
  </figure>;
}

function ReviewDetail({ id, onClose, onDecision }: { id: string; onClose: () => void; onDecision: (message: string) => void }) {
  const [record, setRecord] = useState<IdentityVerification>();
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const abort = new AbortController();
    getIdentityDetail(id, abort.signal).then(data => { if (!abort.signal.aborted) { setRecord(data); } })
      .catch((e: unknown) => { if (!abort.signal.aborted) setError(getErrorMessage(e, 'Could not load this submission.')); });
    return () => abort.abort();
  }, [id, reload]);
  async function decide(approved: boolean) {
    if (!approved && !note.trim()) { setError('Enter a reason before rejecting. The user will see this note.'); return; }
    setBusy(true); setError('');
    try { await decideIdentity(id, approved, note.trim()); onDecision(approved ? 'Identity approved. The user is now verified.' : 'Submission rejected. The user can submit new photos.'); }
    catch (e: unknown) { setError(getErrorMessage(e, 'Could not save the decision.')); setReload(n => n + 1); }
    finally { setBusy(false); }
  }
  return <section aria-label="Submission details" className="rounded-xl border border-border bg-card p-5">
    <div className="mb-5 flex items-start justify-between gap-3"><h3 className="text-lg font-semibold text-ink">Submission details</h3>
      <button onClick={onClose} disabled={busy} className={control}>Close</button></div>
    {error && <div role="alert" className="mb-4 rounded-lg bg-critical/10 p-3 text-sm text-critical">{error}
      {!record && <button className={`${control} ml-3`} onClick={() => { setError(''); setReload(n => n + 1); }}>Retry</button>}</div>}
    {!record ? !error && <p role="status" className="text-ink-soft">Loading submission…</p> : <>
      <div className="mb-5 flex flex-wrap justify-between gap-3"><div>
        <p className="font-semibold text-ink">{record.ownerName ?? 'Deleted user'}</p>
        <p className="text-sm text-ink-soft">{record.ownerEmail}</p>
        <p className="mt-2 text-sm text-ink-soft">{DOCUMENT_LABEL[record.documentType]} · Submitted {date(record.submittedAt)}</p>
      </div><span className="h-fit rounded-full bg-inset px-3 py-1 text-sm text-ink">{STATUS_LABEL[record.status]}</span></div>
      <div className="mb-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{SLOTS.filter(({ slot }) => record.files?.[slot]).map(({ slot, label }) =>
        <PrivateImage key={`${id}-${slot}`} id={id} slot={slot} label={label} />)}</div>
      {record.status === 'pending_review' ? <div className="border-t border-border pt-5">
        <label htmlFor="rejection-note" className="mb-2 block text-sm font-medium text-ink">Rejection reason <span className="font-normal text-ink-soft">(required to reject; shown to the user)</span></label>
        <textarea id="rejection-note" value={note} onChange={e => setNote(e.target.value)} maxLength={500} disabled={busy} rows={3}
          placeholder="Explain which image needs to be retaken and why." className={`${control} w-full resize-y`} />
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><span className="text-xs text-ink-soft">{note.length}/500 characters</span>
          <div className="flex gap-2"><button disabled={busy || !note.trim()} onClick={() => void decide(false)} className="rounded-lg border border-critical px-4 py-2 text-sm font-medium text-critical disabled:opacity-50">Reject</button>
          <button disabled={busy} onClick={() => void decide(true)} className="rounded-lg bg-good px-4 py-2 text-sm font-semibold text-ground disabled:opacity-50">{busy ? 'Saving…' : 'Approve identity'}</button></div></div>
      </div> : <div className="rounded-lg bg-inset p-4 text-sm text-ink-soft"><p>Reviewed {record.reviewedAt ? date(record.reviewedAt) : ''}</p>
        {record.reviewNote && <p className="mt-2 whitespace-pre-wrap text-ink">{record.reviewNote}</p>}</div>}
    </>}
  </section>;
}

export default function IdentityVerificationsPage() {
  const [status, setStatus] = useState<IdentityStatus>('pending_review');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<string>();
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState('');
  const [result, setResult] = useState<{ key: string; data?: IdentityQueue; error?: string }>();
  const queryKey = `${status}-${page}-${revision}`;
  const current = result?.key === queryKey ? result : undefined;
  useEffect(() => {
    const abort = new AbortController();
    getIdentityQueue(status, page, abort.signal).then(data => { if (!abort.signal.aborted) setResult({ key: queryKey, data }); })
      .catch((e: unknown) => { if (!abort.signal.aborted) setResult({ key: queryKey, error: getErrorMessage(e, 'Could not load the review queue.') }); });
    return () => abort.abort();
  }, [status, page, revision, queryKey]);
  function refresh(message = '') { setSelected(undefined); setRevision(n => n + 1); setNotice(message); }
  return <div className="space-y-5">
    <header className="flex flex-wrap items-center justify-between gap-4"><div>
      <h2 className="text-2xl font-bold text-ink">Identity Review</h2>
      <p className="mt-1 text-sm text-ink-soft">Review government IDs and selfies submitted from Settings.</p>
    </div><div className="flex gap-2"><select aria-label="Verification status" value={status} className={control}
      onChange={e => { setStatus(e.target.value as IdentityStatus); setPage(1); setSelected(undefined); setNotice(''); }}>
      {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
      <button className={control} onClick={() => refresh()}>Refresh</button></div></header>
    {notice && <p role="status" className="rounded-lg bg-good/10 p-3 text-sm text-good">{notice}</p>}
    {!current ? <p role="status" className="text-ink-soft">Loading queue…</p> : current.error ?
      <div role="alert" className="rounded-xl border border-critical p-5 text-critical">{current.error}<button className={`${control} ml-3`} onClick={() => refresh()}>Try again</button></div>
      : current.data && <>
        <div className="overflow-x-auto rounded-xl border border-border bg-card">
          <table className="w-full text-left text-sm"><caption className="px-4 py-3 text-left text-ink-soft">{current.data.total} {STATUS_LABEL[status].toLowerCase()} submission{current.data.total === 1 ? '' : 's'}</caption>
            <thead className="border-y border-border bg-inset text-ink-soft"><tr><th className="p-4">User</th><th className="p-4">Document</th><th className="p-4">Submitted</th><th className="p-4"><span className="sr-only">Review</span></th></tr></thead>
            <tbody>{current.data.verifications.map(row => <tr key={row.id} className={`border-b border-border last:border-0 ${selected === row.id ? 'bg-inset' : ''}`}>
              <td className="p-4"><p className="font-medium text-ink">{row.ownerName ?? 'Deleted user'}</p><p className="text-ink-soft">{row.ownerEmail}</p></td>
              <td className="p-4 text-ink">{DOCUMENT_LABEL[row.documentType]}</td><td className="whitespace-nowrap p-4 text-ink-soft">{date(row.submittedAt)}</td>
              <td className="p-4 text-right"><button className={control} aria-expanded={selected === row.id} onClick={() => setSelected(row.id)}>{status === 'pending_review' ? 'Review' : 'View'}</button></td></tr>)}</tbody></table>
          {!current.data.verifications.length && <p className="p-8 text-center text-ink-soft">No submissions on this page.</p>}
        </div>
        <div className="flex items-center justify-between text-sm text-ink-soft"><span>Page {page} of {Math.max(1, Math.ceil(current.data.total / 50))}</span><div className="flex gap-2">
          <button className={control} disabled={page === 1} onClick={() => { setPage(n => n - 1); setSelected(undefined); }}>Previous</button>
          <button className={control} disabled={page * 50 >= current.data.total} onClick={() => { setPage(n => n + 1); setSelected(undefined); }}>Next</button></div></div>
      </>}
    {selected && <ReviewDetail key={selected} id={selected} onClose={() => setSelected(undefined)} onDecision={refresh} />}
  </div>;
}
