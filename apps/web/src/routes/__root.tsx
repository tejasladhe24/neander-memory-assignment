import { AuthProvider } from "@/components/auth-provider"
import { DialogProvider } from "@/components/dialog-provider"
import { ThemeProvider } from "@/components/theme-provider"
import {
  ClientOnly,
  HeadContent,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router"
import { Toaster } from "@workspace/ui/components/sonner"

import appCss from "@workspace/ui/globals.css?url"

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: "utf-8",
      },
      {
        name: "viewport",
        content: "width=device-width, initial-scale=1",
      },
      {
        title: "Neander Memory Assignment",
      },
    ],
    links: [
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
  }),
  notFoundComponent: () => (
    <main className="container mx-auto p-4 pt-16">
      <h1>404</h1>
      <p>The requested page could not be found.</p>
    </main>
  ),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex h-svh w-full flex-col">
        <div className="mx-auto flex size-full flex-col">
          <ThemeProvider>
            <ClientOnly>
              <AuthProvider>
                <DialogProvider>
                  {children}
                  <Toaster />
                </DialogProvider>
              </AuthProvider>
            </ClientOnly>
          </ThemeProvider>
          <Scripts />
        </div>
      </body>
    </html>
  )
}
