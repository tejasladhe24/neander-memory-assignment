import { auth } from "@/lib/auth"
import { redirect } from "@tanstack/react-router"
import { createMiddleware } from "@tanstack/react-start"
import { getRequestHeaders } from "@tanstack/react-start/server"

export const authMiddleware = createMiddleware({ type: "request" }).server(
  async ({ next }) => {
    const sessionData = await auth.api.getSession({
      headers: getRequestHeaders(),
    })

    if (!sessionData?.session || !sessionData?.user) {
      throw redirect({ to: "/login", replace: true })
    }

    return next({
      context: { session: sessionData.session, user: sessionData.user },
    })
  }
)
