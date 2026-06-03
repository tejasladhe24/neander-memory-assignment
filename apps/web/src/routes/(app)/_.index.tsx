import { Chat } from "@/components/chat"
import { generateUUID } from "@/lib/utils"
import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/(app)/_/")({ component: App })

function App() {
  return (
    <div className="flex h-full flex-col gap-4">
      <Chat chatId={generateUUID()} />
    </div>
  )
}
