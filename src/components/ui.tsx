import React from 'react'
import { X } from 'lucide-react'

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'outline'
export function Button({ variant = 'primary', size = 'md', className = '', children, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; size?: 'sm' | 'md' | 'lg' }) {
  return <button type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...props}>{children}</button>
}

export function Badge({ children, tone = 'neutral', className = '' }: { children: React.ReactNode; tone?: 'neutral' | 'green' | 'blue' | 'amber' | 'red' | 'teal'; className?: string }) {
  return <span className={`badge badge-${tone} ${className}`}>{children}</span>
}

export function Modal({ open, title, eyebrow, onClose, children, wide = false }: { open: boolean; title: string; eyebrow?: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  if (!open) return null
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => { if (e.currentTarget === e.target) onClose() }}>
      <section className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head">
          <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2></div>
          <button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={19} /></button>
        </header>
        <div className="modal-body">{children}</div>
      </section>
    </div>
  )
}

export function PageTitle({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: React.ReactNode }) {
  return <div className="page-title-row"><div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>{action && <div className="page-title-action">{action}</div>}</div>
}

export function EmptyState({ icon, title, description, action }: { icon: React.ReactNode; title: string; description: string; action?: React.ReactNode }) {
  return <div className="empty-state"><div className="empty-icon">{icon}</div><h3>{title}</h3><p>{description}</p>{action && <div className="empty-action">{action}</div>}</div>
}

export function Field({ label, hint, error, children, required = false }: { label: string; hint?: string; error?: string; children: React.ReactNode; required?: boolean }) {
  return <label className="field"><span className="field-label">{label}{required && <em> *</em>}</span>{children}{hint && <span className="field-hint">{hint}</span>}{error && <span className="field-error">{error}</span>}</label>
}

export function Skeleton({ height = 18, width = '100%' }: { height?: number; width?: string | number }) {
  return <span className="skeleton" style={{ height, width }} />
}
