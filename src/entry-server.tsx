import { createHandler, StartServer } from "@solidjs/start/server";
import { COLOR_SCHEME_BOOT } from "~/lib/color-scheme";

export default createHandler(() => (
  <StartServer
    document={({ assets, children, scripts }) => (
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <meta property="og:description" content="Unofficial, community-run catalog of Antora extensions (build-time pipeline extensions, CI checkers and validators, generators, utilities, and UI-side add-ons) and Antora UI themes, with install guidance. Not affiliated with the Antora project." />
          <meta name="twitter:description" content="Unofficial, community-run catalog of Antora extensions (build-time pipeline extensions, CI checkers and validators, generators, utilities, and UI-side add-ons) and Antora UI themes, with install guidance. Not affiliated with the Antora project." />
          {/* Apply the stored or system color scheme before first paint (no flash). */}
          <script innerHTML={COLOR_SCHEME_BOOT} />
          <link rel="icon" href="/favicon.ico" sizes="48x48" />
          <link rel="icon" type="image/svg+xml" href="/brand/registry-mark.svg" />
          <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
          <link rel="manifest" href="/site.webmanifest" />
          <meta name="theme-color" content="#111111" />
          <meta property="og:image" content="https://registry.antora-supplemental.org/brand/registry-mark-1024.png" />
          <meta name="twitter:image" content="https://registry.antora-supplemental.org/brand/registry-mark-1024.png" />
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
          <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
          {assets}
        </head>
        <body>
          <div id="app">{children}</div>
          {scripts}
        </body>
      </html>
    )}
  />
));
