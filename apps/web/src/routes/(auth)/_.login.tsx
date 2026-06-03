import { createFileRoute } from "@tanstack/react-router"
import { LoginForm } from "@/components/login-form"

export const Route = createFileRoute("/(auth)/_/login")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <LoginForm />
    </div>
  )
}
