import { authMiddleware } from "@/middlewares/auth"
import { createServerFn } from "@tanstack/react-start"

export const getSession = createServerFn()
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    return { session: context.session, user: context.user }
  })
