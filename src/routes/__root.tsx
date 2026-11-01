import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestUrl } from "@tanstack/react-start/server";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: ErrorComponentProps) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

const getSiteOrigin = createIsomorphicFn()
  .server(() => getRequestUrl().origin)
  .client(() => window.location.origin);

const appName = "Procedimentos Capilares";
const shareDescription =
  "Um tempo para você. Um diário para lembrar. Registre seus procedimentos e acompanhe seus gastos com beleza.";
const shareImageAlt =
  "Mulher sorrindo ao lado do título Procedimentos Capilares, em branco e rosa sobre fundo escuro";

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  beforeLoad: () => ({ siteOrigin: getSiteOrigin() }),
  head: ({ match: { context } }) => {
    const shareImage = `${context.siteOrigin}/images/compartilhar-capilares.jpg`;
    return {
      meta: [
        { charSet: "utf-8" },
        { name: "theme-color", content: "#1b1a1e" },
        { name: "apple-mobile-web-app-capable", content: "yes" },
        { name: "mobile-web-app-capable", content: "yes" },
        { name: "apple-mobile-web-app-title", content: "Capilares" },
        { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: appName },
        { property: "og:locale", content: "pt_BR" },
        { property: "og:title", content: appName },
        { property: "og:description", content: shareDescription },
        { property: "og:url", content: `${context.siteOrigin}/` },
        { property: "og:image", content: shareImage },
        { property: "og:image:secure_url", content: shareImage },
        { property: "og:image:type", content: "image/jpeg" },
        { property: "og:image:width", content: "1200" },
        { property: "og:image:height", content: "630" },
        { property: "og:image:alt", content: shareImageAlt },
        { name: "twitter:card", content: "summary_large_image" },
        { name: "twitter:title", content: appName },
        { name: "twitter:description", content: shareDescription },
        { name: "twitter:image", content: shareImage },
        { name: "twitter:image:alt", content: shareImageAlt },
      ],
      links: [
        {
          rel: "stylesheet",
          href: appCss,
        },
        { rel: "preconnect", href: "https://fonts.googleapis.com" },
        {
          rel: "stylesheet",
          href: "https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&display=swap",
        },
        { rel: "icon", href: "/favicon.ico?v=3", sizes: "48x48" },
        { rel: "icon", href: "/brand-mark.svg?v=3", type: "image/svg+xml" },
        { rel: "icon", href: "/icons/favicon-32.png?v=3", type: "image/png", sizes: "32x32" },
        { rel: "manifest", href: "/manifest.webmanifest?v=3" },
        { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon.png?v=3" },
      ],
    };
  },
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (import.meta.env.PROD && "serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((error: unknown) => {
        console.error("Não foi possível ativar o modo offline.", error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {/* Required: nested routes render here. Removing <Outlet /> breaks all child routes. */}
      <Outlet />
    </QueryClientProvider>
  );
}
