// @refresh reload
import { MetaProvider } from "@solidjs/meta";
import { cache, Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense, type ParentProps } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import "./app.css";
import { auth, type Session } from "~/server/auth";

export const getSessionData = cache(async (): Promise<Session | null> => {
  "use server";
  const event = getRequestEvent();
  if (!event) return null;
  return auth.api.getSession({ headers: event.request.headers });
}, "session");

function RootLayout(props: ParentProps) {
  return (
    <MetaProvider>
      <Suspense>{props.children}</Suspense>
    </MetaProvider>
  );
}

export default function App() {
  return (
    <Router root={RootLayout}>
      <FileRoutes />
    </Router>
  );
}
