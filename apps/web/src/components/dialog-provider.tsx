import React, { createContext, useContext, useMemo, useState } from "react"

type DialogData = Record<string, any>

interface IDialogContext {
  isOpen: boolean
  type: string | null
  data: Record<string, any>
  onOpen: (type: string, data?: DialogData) => void
  onClose: () => void
}

const Context = createContext<IDialogContext>({
  type: null,
  isOpen: false,
  data: {},
  onOpen: () => {},
  onClose: () => {},
})

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState<boolean>(false)
  const [type, setType] = useState<string | null>(null)
  const [data, setData] = useState<DialogData>({})

  function onOpen(type: string, data?: DialogData) {
    setType(type)
    setData(data ?? {})
    setIsOpen(true)
  }

  function onClose() {
    setType(null)
    setData({})
    setIsOpen(false)
  }

  const value = useMemo(
    () => ({ isOpen, type, data, onClose, onOpen }),
    [isOpen, type, data]
  )

  return <Context.Provider value={value}>{children}</Context.Provider>
}

DialogProvider.displayName = "DialogProvider"

export const useDialog = () => useContext<IDialogContext>(Context)
