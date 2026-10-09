type ClassValue = string | number | false | null | undefined | ClassValue[] | Record<string, boolean | null | undefined>

export function cn(...inputs: ClassValue[]): string {
  const out: string[] = []
  const walk = (v: ClassValue) => {
    if (!v) return
    if (typeof v === 'string' || typeof v === 'number') {
      out.push(String(v))
    } else if (Array.isArray(v)) {
      v.forEach(walk)
    } else {
      for (const k in v) if (v[k]) out.push(k)
    }
  }
  inputs.forEach(walk)
  return out.join(' ')
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function todayISO(): string {
  return new Date().toISOString()
}

export function dateOnly(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function fmtDate(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function fmtDateTime(iso?: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  return d.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function isExpired(iso: string): boolean {
  return new Date(iso).getTime() < Date.now()
}

export function generatePatientId(existing: string[]): string {
  const year = new Date().getFullYear()
  for (let i = 0; i < 200; i++) {
    const candidate = `MV-${year}-${String(Math.floor(1000 + Math.random() * 9000))}`
    if (!existing.includes(candidate)) return candidate
  }
  return `MV-${year}-${Date.now().toString(36)}`
}

export function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
