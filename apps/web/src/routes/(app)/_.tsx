import { AppSidebar } from "@/components/app-sidebar"
import { ChatHeader } from "@/components/chat-header"
import { getSession } from "@/server/auth"
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { SidebarInset, SidebarProvider } from "@workspace/ui/components/sidebar"

export const Route = createFileRoute("/(app)/_")({
  component: App,
  loader: async () => {
    const sessionData = await getSession()

    if (!sessionData?.session || !sessionData?.user) {
      throw redirect({ to: "/login", replace: true })
    }
  },
})

function App() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <ChatHeader />
        <main className="flex h-full flex-1 flex-col">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
