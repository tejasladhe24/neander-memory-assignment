import { chatCollection } from "@/lib/collections/chat"
import { useParams } from "@tanstack/react-router"
import { Separator } from "@workspace/ui/components/separator"
import { SidebarTrigger } from "@workspace/ui/components/sidebar"
import { and, eq, useLiveQuery } from "@tanstack/react-db"
import { useAuth } from "./auth-provider"

export const ChatHeader = () => {
  const { chatId } = useParams({ strict: false })
  const { user } = useAuth()

  const {
    data: [chat],
  } = useLiveQuery(
    (q) => {
      return q
        .from({ chat: chatCollection })
        .where(({ chat }) =>
          and(eq(chat.id, chatId), eq(chat.userId, user?.id))
        )
    },
    [chatId, user?.id]
  )

  return (
    <header className="flex h-14 shrink-0 items-center gap-2">
      <div className="flex flex-1 items-center gap-2 px-3">
        <SidebarTrigger />
        {chatId && (
          <>
            <Separator
              orientation="vertical"
              className="mr-2 data-[orientation=vertical]:h-4"
            />
            <h1 className="text-lg font-semibold">{chat?.title}</h1>
          </>
        )}
      </div>
    </header>
  )
}
