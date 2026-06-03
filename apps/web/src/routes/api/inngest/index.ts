import { createFileRoute } from "@tanstack/react-router"
import { serve } from "inngest/edge"
import { createMemory, inngest } from "@/lib/inngest"

const handler = serve({
  client: inngest,
  functions: [createMemory],
})

export const Route = createFileRoute("/api/inngest/")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => handler(request),
      POST: async ({ request }: { request: Request }) => handler(request),
      PUT: async ({ request }: { request: Request }) => handler(request),
    },
  },
})
