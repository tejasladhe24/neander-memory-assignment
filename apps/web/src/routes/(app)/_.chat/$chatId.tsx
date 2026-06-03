import { Chat } from "@/components/chat"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(app)/_/chat/$chatId")({
  component: RouteComponent,
})

function RouteComponent() {
  const { chatId } = Route.useParams()

  return (
    <div className="flex h-full flex-col gap-4">
      <Chat chatId={chatId} />
    </div>
  )
}
