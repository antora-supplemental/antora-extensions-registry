import { A } from '@solidjs/router';
import { HttpStatusCode } from '@solidjs/start';
import SiteLayout from '~/components/SiteLayout';

/** Catch-all for unknown paths (including the removed /registry): real content and HTTP 404. */
export default function NotFound() {
  return (
    <SiteLayout title="Page not found">
      <HttpStatusCode code={404} />
      <div class="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 class="text-3xl font-bold text-white mb-3">Page not found</h1>
        <p class="text-slate-400 mb-6">There is nothing at this address.</p>
        <div class="flex justify-center gap-6">
          <A href="/extensions" class="text-primary-400 hover:text-primary-300">Browse extensions</A>
          <A href="/themes" class="text-primary-400 hover:text-primary-300">Browse themes</A>
        </div>
      </div>
    </SiteLayout>
  );
}
