import { ClientOnly, createFileRoute, Outlet } from "@tanstack/react-router"

export const Route = createFileRoute("/(auth)/_")({
  component: RouteComponent,
})

function RouteComponent() {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <ClientOnly>
        <Outlet />
      </ClientOnly>
    </div>
  )
}
