import { useChat } from "@ai-sdk/react"
import { eq, useLiveQuery } from "@tanstack/react-db"
import { useAuth } from "../auth-provider"
import { messageCollection } from "@/lib/collections/message"
import { useCallback, useEffect, useMemo, useState } from "react"
import { convertToUIMessages, generateUUID } from "@/lib/utils"
import type { PGMessage } from "@workspace/database"
import { DefaultChatTransport } from "ai"
import { env } from "@/env"
import { toast } from "sonner"
import {
  Conversation,
  ConversationContent,
  ConversationDownload,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@workspace/ui/components/ai-elements/conversation"
import { MessageSquare } from "lucide-react"
import {
  PromptInput,
  type PromptInputMessage,
  PromptInputTextarea,
  PromptInputSubmit,
  PromptInputBody,
  PromptInputFooter,
  PromptInputTools,
} from "@workspace/ui/components/ai-elements/prompt-input"
import {
  Message,
  MessageContent,
  MessageResponse,
} from "@workspace/ui/components/ai-elements/message"
import {
  ModelSelector,
  ModelSelectorContent,
  ModelSelectorEmpty,
  ModelSelectorGroup,
  ModelSelectorInput,
  ModelSelectorItem,
  ModelSelectorList,
  ModelSelectorLogo,
  ModelSelectorName,
  ModelSelectorTrigger,
} from "@workspace/ui/components/ai-elements/model-selector"
import { chatModels } from "@/lib/ai/models"
import { Button } from "@workspace/ui/components/button"

interface ChatProps {
  chatId: string
}

export const Chat = ({ chatId }: ChatProps) => {
  const { user } = useAuth()

  const [input, setInput] = useState("")
  const [modelSelectorOpen, setModelSelectorOpen] = useState(false)
  const [selectedModel, setSelectedModel] = useState<string>(
    env.VITE_DEFAULT_CHAT_MODEL
  )

  const { data: dbMessages } = useLiveQuery(
    (q) => {
      return q
        .from({ message: messageCollection })
        .where(({ message }) => eq(message.chatId, chatId))
        .orderBy(({ message }) => message.createdAt)
    },
    [user?.id]
  )

  const uiMessages = useMemo(
    () => convertToUIMessages(dbMessages as PGMessage[]),
    [dbMessages]
  )

  const { messages, setMessages, sendMessage, status } = useChat({
    id: chatId,
    messages: uiMessages,
    generateId: generateUUID,
    transport: new DefaultChatTransport({
      api: `${env.VITE_SELF_URL}/api/chat`,
      prepareSendMessagesRequest(request) {
        return {
          body: {
            id: request.id,
            message: request.messages.at(-1),
            model: selectedModel,
            ...request.body,
          },
        }
      },
    }),
    onData: (dataPart) => {
      console.log(dataPart)
    },
    onFinish: () => {
      window.history.replaceState({}, "", `/chat/${chatId}`)
    },
    onError: (error) => {
      toast.error(error.message || "Oops, an error occurred!")
    },
  })

  const handleSubmit = useCallback(
    (message: PromptInputMessage) => {
      const hasText = Boolean(message.text)
      const hasAttachments = message.files.length > 0

      if (!(hasText || hasAttachments)) {
        return
      }

      if (message.files.length > 0) {
        toast.success("Files attached", {
          description: `${message.files.length} file(s) attached to message`,
        })
      }

      sendMessage(
        {
          text: message.text || "Sent with attachments",
          files: message.files,
        },
        {
          body: {
            model: selectedModel,
          },
        }
      )

      setInput("")
    },
    [sendMessage, selectedModel]
  )

  const handleModelSelect = useCallback((id: string) => {
    setSelectedModel(id)
    setModelSelectorOpen(false)
  }, [])

  const selectedModelData = chatModels.find(
    (model) => model.id === selectedModel
  )

  useEffect(() => {
    setMessages(uiMessages)
  }, [uiMessages])

  const chefs = [...new Set(chatModels.map((model) => model.chef))]

  return (
    <div className="relative h-full rounded-lg border">
      <div className="flex h-full flex-col">
        <Conversation>
          <ConversationContent>
            {messages.length === 0 ? (
              <ConversationEmptyState
                icon={<MessageSquare className="size-12" />}
                title="Start a conversation"
                description="Type a message below to begin chatting"
              />
            ) : (
              messages.map((message) => (
                <Message from={message.role} key={message.id}>
                  <MessageContent>
                    {message.parts.map((part, i) => {
                      switch (part.type) {
                        case "text": // we don't use any reasoning or tool calls in this example
                          return (
                            <MessageResponse key={`${message.id}-${i}`}>
                              {part.text}
                            </MessageResponse>
                          )
                        default:
                          return null
                      }
                    })}
                  </MessageContent>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>
        <PromptInput
          onSubmit={handleSubmit}
          className="relative mx-auto w-full p-4"
        >
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              {/* <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  <PromptInputActionAddAttachments />
                </PromptInputActionMenuContent>
              </PromptInputActionMenu> */}
              <ModelSelector
                onOpenChange={setModelSelectorOpen}
                open={modelSelectorOpen}
              >
                <ModelSelectorTrigger asChild>
                  <Button
                    className="w-[200px] justify-between"
                    variant="outline"
                  >
                    {selectedModelData?.chefSlug && (
                      <ModelSelectorLogo
                        provider={selectedModelData.chefSlug}
                      />
                    )}
                    {selectedModelData?.name && (
                      <ModelSelectorName>
                        {selectedModelData.name}
                      </ModelSelectorName>
                    )}
                  </Button>
                </ModelSelectorTrigger>
                <ModelSelectorContent>
                  <ModelSelectorInput placeholder="Search models..." />
                  <ModelSelectorList>
                    <ModelSelectorEmpty>No models found.</ModelSelectorEmpty>
                    {chefs.map((chef) => (
                      <ModelSelectorGroup heading={chef} key={chef}>
                        {chatModels
                          .filter((model) => model.chef === chef)
                          .map((model) => (
                            <ModelSelectorItem
                              key={model.id}
                              value={model.id}
                              onSelect={() => handleModelSelect(model.id)}
                            />
                          ))}
                      </ModelSelectorGroup>
                    ))}
                  </ModelSelectorList>
                </ModelSelectorContent>
              </ModelSelector>
            </PromptInputTools>
            <PromptInputSubmit disabled={!input.trim()} status={status} />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  )
}
