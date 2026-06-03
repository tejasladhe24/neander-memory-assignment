import { createFileRoute } from "@tanstack/react-router"
import { ResetPasswordForm } from "@/components/reset-password-form"

export const Route = createFileRoute("/(auth)/_/reset-password")({
  component: RouteComponent,
  validateSearch: (search) => {
    return {
      token: search.token as string | undefined,
    }
  },
})

function RouteComponent() {
  const { token } = Route.useSearch()

  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ResetPasswordForm token={token} />
    </div>
  )
}
