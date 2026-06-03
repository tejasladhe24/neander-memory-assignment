import { FolderXIcon } from "lucide-react"

import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@workspace/ui/components/empty"

interface ErrorComponentProps {
  error: Error
  reset: () => void
}

export function ErrorComponent({ error, reset }: ErrorComponentProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center">
      <Empty>
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <FolderXIcon />
          </EmptyMedia>
          <EmptyTitle>500 - Internal Server Error</EmptyTitle>
          <EmptyDescription>
            {error.message ?? "Something went wrong!"}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent className="flex-row justify-center gap-2">
          <Button onClick={reset}>Go to Home</Button>
          <Button variant="outline" onClick={reset}>
            Reset
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
