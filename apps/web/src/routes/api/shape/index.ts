import { createFileRoute } from "@tanstack/react-router"
import { env } from "@/env"
import { authMiddleware } from "@/middlewares/auth"

export const Route = createFileRoute("/api/shape/")({
  server: {
    middleware: [authMiddleware],
    handlers: {
      GET: async ({ request }) => {
        const requestUrl = new URL(request.url)
        const electricUrl = new URL("/v1/shape", env.ELECTRIC_URL)

        // Add Electric SQL credentials
        electricUrl.searchParams.set("secret", env.ELECTRIC_SECRET!)

        requestUrl.searchParams.forEach((value, key) => {
          electricUrl.searchParams.set(key, value)
        })

        // Proxy the request to Electric SQL
        const response = await fetch(electricUrl)

        // Remove problematic headers that could break decoding
        const responseHeaders = new Headers(response.headers)
        responseHeaders.delete("content-encoding")
        responseHeaders.delete("content-length")

        return new Response(response.body, {
          status: response.status,
          statusText: response.statusText,
          headers: responseHeaders,
        })
      },
    },
  },
})
