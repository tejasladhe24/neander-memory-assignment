import { createFileRoute } from "@tanstack/react-router"
import { SignupForm } from "@/components/signup-form"

export const Route = createFileRoute("/(auth)/_/signup")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <SignupForm />
    </div>
  )
}
