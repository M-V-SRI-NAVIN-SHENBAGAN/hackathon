import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'
import { uid } from '../lib/utils'

type ToastItem = { id: string; message: string; kind: 'success' | 'error' | 'info' }
const ToastContext = createContext<(message: string, kind?: ToastItem['kind']) => void>(() => {})

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([])
  const toast = useCallback((message: string, kind: ToastItem['kind'] = 'success') => {
    const id = uid('toast')
    setItems(prev => [...prev, { id, message, kind }])
    window.setTimeout(() => setItems(prev => prev.filter(item => item.id !== id)), 4200)
  }, [])
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="toast-stack" aria-live="polite">
        {items.map(item => (
          <div className={`toast toast-${item.kind}`} key={item.id}>
            {item.kind === 'success' ? <CheckCircle2 size={17} /> : item.kind === 'error' ? <TriangleAlert size={17} /> : <Info size={17} />}
            <span>{item.message}</span>
            <button aria-label="Dismiss notification" onClick={() => setItems(prev => prev.filter(x => x.id !== item.id))}><X size={15} /></button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

export const useToast = () => useContext(ToastContext)
