import { createFileRoute } from "@tanstack/react-router"
import { ForgotPasswordForm } from "@/components/forgot-password-form"

export const Route = createFileRoute("/(auth)/_/forgot-password")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ForgotPasswordForm />
    </div>
  )
}
