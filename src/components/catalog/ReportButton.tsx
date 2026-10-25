import { A, createAsync, useLocation } from '@solidjs/router';
import { createSignal, For, Show } from 'solid-js';
import { Portal } from 'solid-js/web';
import { getSessionData } from '~/app';
import { buttonVariants } from '~/components/ui/button';
import { cn } from '~/lib/utils';
import { REPORT_MESSAGE_MAX, REPORT_REASONS, type ReportReason } from '~/lib/report-reasons';
import { submitReport } from '~/lib/server/reports';

const field = 'w-full px-3 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-white text-sm';

/** "Report" link plus dialog for an extension or theme. */
export default function ReportButton(props: { itemKind: 'extension' | 'theme'; itemId: string; itemName: string; class?: string }) {
  const session = createAsync(() => getSessionData());
  const location = useLocation();
  const [open, setOpen] = createSignal(false);
  const [reason, setReason] = createSignal<ReportReason | ''>('');
  const [message, setMessage] = createSignal('');
  const [busy, setBusy] = createSignal(false);
  const [result, setResult] = createSignal<{ ok: boolean; message: string } | null>(null);

  const close = () => {
    setOpen(false);
    setResult(null);
  };

  const submit = async (e: Event) => {
    e.preventDefault();
    if (!reason()) return;
    setBusy(true);
    try {
      setResult(await submitReport({ itemKind: props.itemKind, itemId: props.itemId, itemName: props.itemName, reason: reason() as ReportReason, message: message() }));
    } catch {
      setResult({ ok: false, message: 'The report could not be sent. Try again.' });
    }
    setBusy(false);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} class={cn('text-xs text-slate-400 hover:text-red-300 underline-offset-2 hover:underline', props.class)}>
        Report
      </button>
      <Show when={open()}>
        <Portal>
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={(e) => e.target === e.currentTarget && close()}>
            <div role="dialog" aria-modal="true" aria-labelledby="report-title" class="w-full max-w-md rounded-xl border border-slate-700/50 bg-slate-900 p-6 shadow-xl">
              <h2 id="report-title" class="text-lg font-semibold text-white mb-1">Report {props.itemName}</h2>
              <Show
                when={session()?.user}
                fallback={
                  <div class="space-y-4">
                    <p class="text-sm text-slate-400">Sign in to send a report.</p>
                    <div class="flex justify-end gap-2">
                      <button type="button" onClick={close} class={buttonVariants({ variant: 'secondary', size: 'sm' })}>Cancel</button>
                      <A href={`/auth/signin?redirect=${encodeURIComponent(location.pathname)}`} class={buttonVariants({ size: 'sm' })}>Sign in</A>
                    </div>
                  </div>
                }
              >
                <Show
                  when={!result()?.ok}
                  fallback={
                    <div class="space-y-4">
                      <p class="text-sm text-slate-300" role="status">{result()!.message}</p>
                      <div class="flex justify-end"><button type="button" onClick={close} class={buttonVariants({ size: 'sm' })}>Close</button></div>
                    </div>
                  }
                >
                  <form onSubmit={submit} class="space-y-4">
                    <p class="text-sm text-slate-400">Registry admins read every report.</p>
                    <label class="block text-sm text-slate-300">
                      Reason
                      <select required value={reason()} onChange={(e) => setReason(e.currentTarget.value as ReportReason)} class={cn(field, 'mt-1')}>
                        <option value="" disabled>Choose a reason</option>
                        <For each={REPORT_REASONS}>{(r) => <option value={r.value}>{r.label}</option>}</For>
                      </select>
                    </label>
                    <label class="block text-sm text-slate-300">
                      Details (optional)
                      <textarea rows={4} maxLength={REPORT_MESSAGE_MAX} value={message()} onInput={(e) => setMessage(e.currentTarget.value)} class={cn(field, 'mt-1')} />
                      <span class="block text-right text-xs text-slate-400">{message().length}/{REPORT_MESSAGE_MAX}</span>
                    </label>
                    <Show when={result() && !result()!.ok}>
                      <p class="text-sm text-red-400" role="alert">{result()!.message}</p>
                    </Show>
                    <div class="flex justify-end gap-2">
                      <button type="button" onClick={close} class={buttonVariants({ variant: 'secondary', size: 'sm' })}>Cancel</button>
                      <button type="submit" disabled={busy() || !reason()} class={buttonVariants({ size: 'sm' })}>{busy() ? 'Sending…' : 'Send report'}</button>
                    </div>
                  </form>
                </Show>
              </Show>
            </div>
          </div>
        </Portal>
      </Show>
    </>
  );
}
