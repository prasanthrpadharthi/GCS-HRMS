"use client"

import * as React from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface AlertContextType {
  showAlert: (title: string, message: string) => Promise<void>
  showConfirm: (title: string, message: string) => Promise<boolean>
}

const AlertContext = React.createContext<AlertContextType | undefined>(undefined)

export function AlertProvider({ children }: { children: React.ReactNode }) {
  const [alertState, setAlertState] = React.useState<{
    open: boolean
    title: string
    message: string
    type: "alert" | "confirm"
    resolve?: (value: boolean) => void
  }>({
    open: false,
    title: "",
    message: "",
    type: "alert",
  })

  const showAlert = React.useCallback((title: string, message: string) => {
    return new Promise<void>((resolve) => {
      setAlertState({
        open: true,
        title,
        message,
        type: "alert",
        resolve: () => resolve(),
      })
    })
  }, [])

  const showConfirm = React.useCallback((title: string, message: string) => {
    return new Promise<boolean>((resolve) => {
      setAlertState({
        open: true,
        title,
        message,
        type: "confirm",
        resolve,
      })
    })
  }, [])

  const handleClose = (confirmed: boolean = false) => {
    if (alertState.resolve) {
      alertState.resolve(confirmed)
    }
    setAlertState((prev) => ({ ...prev, open: false }))
  }

  return (
    <AlertContext.Provider value={{ showAlert, showConfirm }}>
      {children}
      <Dialog open={alertState.open} onOpenChange={(open: boolean) => !open && handleClose(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{alertState.title}</DialogTitle>
            <DialogDescription>{alertState.message}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            {alertState.type === "confirm" ? (
              <>
                <Button variant="outline" onClick={() => handleClose(false)}>Cancel</Button>
                <Button onClick={() => handleClose(true)}>Confirm</Button>
              </>
            ) : (
              <Button onClick={() => handleClose(false)}>OK</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AlertContext.Provider>
  )
}

export function useAlert() {
  const context = React.useContext(AlertContext)
  if (!context) {
    throw new Error("useAlert must be used within an AlertProvider")
  }
  return context
}
