import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { AccessRequest, DBState, GrantScope, MedicalRecord, Profile, SharingGrant } from '../lib/types'
import { AccessDeniedError } from '../lib/types'
import { createInitialState } from '../lib/demo'
import { generatePatientId, todayISO, uid } from '../lib/utils'

const STORAGE_KEY = 'medivault_demo_v2'


function bytesToHex(bytes: Uint8Array) { return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('') }
function hexToBytes(value: string) { return new Uint8Array(value.match(/.{1,2}/g)?.map(part => parseInt(part, 16)) || []) }
async function passwordVerifier(password: string, salt?: string) {
  if (!globalThis.crypto?.subtle) throw new Error('Secure browser crypto is unavailable. Use a modern browser over HTTPS for account creation.')
  const saltBytes = salt ? hexToBytes(salt) : crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: saltBytes, iterations: 120000 }, key, 256)
  return { hash: bytesToHex(new Uint8Array(bits)), salt: bytesToHex(saltBytes) }
}

function loadState(): DBState {
  if (typeof window === 'undefined') return createInitialState()
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const saved = JSON.parse(raw) as DBState
      if (saved && Array.isArray(saved.profiles) && Array.isArray(saved.records) && 'session' in saved) {
        const fresh = createInitialState()
        // Keep the current seeded demo definitions while preserving actions in local storage.
        return { ...fresh, ...saved, session: null }
      }
    }
  } catch {
    // Corrupt or unavailable local storage starts a fresh fictional demo.
  }
  return createInitialState()
}

export function activeGrantFor(db: DBState, patientId: string, doctorId: string): SharingGrant | undefined {
  const now = Date.now()
  return db.grants.find(g => g.patientId === patientId && g.doctorId === doctorId && g.status === 'active' && new Date(g.expiresAt).getTime() > now)
}

export function scopeIncludesRecord(scope: GrantScope, record: MedicalRecord): boolean {
  if (scope.type === 'all') return true
  if (scope.type === 'categories') return scope.categories.includes(record.category)
  return scope.recordIds.includes(record.id)
}

export function readAuthorizedRecords(db: DBState, doctorId: string, patientId: string): MedicalRecord[] {
  const grant = activeGrantFor(db, patientId, doctorId)
  if (!grant) throw new AccessDeniedError('Access denied. Patient consent is missing, revoked, or expired.')
  return db.records.filter(r => r.patientId === patientId && scopeIncludesRecord(grant.scope, r))
}

export function grantCoversAllHealthData(grant: SharingGrant | undefined): boolean {
  return Boolean(grant && grant.scope.type === 'all')
}

interface StoreValue {
  db: DBState
  currentUser: Profile | null
  isDemo: boolean
  mutate: (fn: (previous: DBState) => DBState) => void
  loginDemo: (profileId: string) => void
  login: (email: string, password: string, role: 'patient' | 'doctor') => Promise<{ ok: boolean; error?: string }>
  register: (data: { role: 'patient' | 'doctor'; name: string; email: string; password: string; dob?: string; gender?: string; phone?: string; specialization?: string; hospital?: string; registrationNumber?: string }) => Promise<{ ok: boolean; error?: string; patientId?: string }>
  logout: () => void
  addAudit: (action: DBState['audit'][number]['action'], detail: string, targetPatientId?: string) => void
  getActiveGrant: (patientId: string, doctorId: string) => SharingGrant | undefined
  getDoctorRecords: (patientId: string) => MedicalRecord[]
  createGrant: (args: { doctorId: string; scope: GrantScope; expiresAt: string; label?: string; requestId?: string }) => { ok: boolean; error?: string }
  revokeGrant: (grantId: string) => { ok: boolean; error?: string }
  createAccessRequest: (patientIdentifier: string, message?: string) => { ok: boolean; message: string }
  respondToRequest: (requestId: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<DBState>(loadState)
  const currentUser = useMemo(() => db.profiles.find(p => p.id === db.session?.profileId) || null, [db.profiles, db.session])

  useEffect(() => {
    try {
      // Authentication sessions are tab-local and are never persisted.
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...db, session: null }))
    } catch {
      // A full localStorage or privacy setting never blocks the current session.
    }
  }, [db])

  useEffect(() => {
    const syncOtherTab = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return
      try {
        const saved = JSON.parse(event.newValue) as DBState
        if (!saved || !Array.isArray(saved.profiles) || !Array.isArray(saved.records)) return
        const fresh = createInitialState()
        setDb(previous => ({ ...fresh, ...saved, session: previous.session }))
      } catch {
        // An invalid cross-tab payload is ignored; normal actions remain available.
      }
    }
    window.addEventListener('storage', syncOtherTab)
    return () => window.removeEventListener('storage', syncOtherTab)
  }, [])

  const mutate = useCallback((fn: (previous: DBState) => DBState) => setDb(prev => fn(prev)), [])

  const audit = useCallback((state: DBState, action: DBState['audit'][number]['action'], detail: string, targetPatientId?: string, actor?: Profile | null) => {
    const who = actor || state.profiles.find(p => p.id === state.session?.profileId)
    if (!who) return state
    return {
      ...state,
      audit: [{
        id: uid('audit'), timestamp: todayISO(), actorId: who.id, actorName: who.name, actorRole: who.role,
        action, targetPatientId, detail,
      }, ...state.audit],
    }
  }, [])

  const loginDemo = useCallback((profileId: string) => {
    setDb(prev => {
      const profile = prev.profiles.find(p => p.id === profileId)
      if (!profile) return prev
      const logged = { ...prev, session: { profileId } }
      return audit(logged, 'login', 'Signed in to a fictional demo account.', profile.role === 'patient' ? profile.id : undefined, profile)
    })
  }, [audit])

  const login = useCallback(async (email: string, password: string, role: 'patient' | 'doctor') => {
    const profile = db.profiles.find(p => p.email.toLowerCase() === email.trim().toLowerCase() && p.role === role)
    if (!profile?.passwordHash || !profile.passwordSalt) return { ok: false, error: 'We could not verify those details. Demo accounts use the quick-access buttons.' }
    try {
      const verifier = await passwordVerifier(password, profile.passwordSalt)
      if (verifier.hash !== profile.passwordHash) return { ok: false, error: 'We could not verify those details. Check your email and password.' }
    } catch { return { ok: false, error: 'Could not verify the password in this browser.' } }
    setDb(prev => {
      const logged = { ...prev, session: { profileId: profile.id } }
      return audit(logged, 'login', 'Signed in to a local demo account.', profile.role === 'patient' ? profile.id : undefined, profile)
    })
    return { ok: true }
  }, [audit, db.profiles])

  const register = useCallback(async (data: { role: 'patient' | 'doctor'; name: string; email: string; password: string; dob?: string; gender?: string; phone?: string; specialization?: string; hospital?: string; registrationNumber?: string }) => {
    if (db.profiles.some(p => p.email.toLowerCase() === data.email.trim().toLowerCase())) return { ok: false, error: 'An account with this email already exists.' }
    let verifier: { hash: string; salt: string }
    try { verifier = await passwordVerifier(data.password) }
    catch (error) { return { ok: false, error: error instanceof Error ? error.message : 'Could not create a password verifier.' } }
    const profileId = uid(data.role)
    const profile: Profile = { id: profileId, role: data.role, name: data.name.trim(), email: data.email.trim(), passwordHash: verifier.hash, passwordSalt: verifier.salt, createdAt: todayISO() }
    let patientId: string | undefined
    const next: DBState = { ...db, profiles: [...db.profiles, profile], session: { profileId } }
    if (data.role === 'patient') {
      patientId = generatePatientId(db.patients.map(p => p.patientId))
      next.patients = [...db.patients, { profileId, patientId, dob: data.dob || '', gender: data.gender, phone: data.phone }]
      next.emergencyTokens = [...db.emergencyTokens, { patientId: profileId, token: uid('protected-workflow'), createdAt: todayISO(), active: true }]
    } else {
      next.doctors = [...db.doctors, { profileId, specialization: data.specialization || 'General Physician', hospital: data.hospital || '', registrationNumber: data.registrationNumber || 'DEMO-PENDING' }]
    }
    setDb(audit(next, 'login', 'New local demo account created and signed in.', data.role === 'patient' ? profileId : undefined, profile))
    return { ok: true, patientId }
  }, [audit, db])

  const logout = useCallback(() => {
    setDb(prev => {
      const logged = audit(prev, 'logout', 'Signed out of MediVault demo.')
      return { ...logged, session: null }
    })
  }, [audit])

  const addAudit = useCallback((action: DBState['audit'][number]['action'], detail: string, targetPatientId?: string) => {
    setDb(prev => audit(prev, action, detail, targetPatientId))
  }, [audit])

  const getActiveGrant = useCallback((patientId: string, doctorId: string) => activeGrantFor(db, patientId, doctorId), [db])
  const getDoctorRecords = useCallback((patientId: string) => {
    if (!currentUser || currentUser.role !== 'doctor') throw new AccessDeniedError('Doctor role required.')
    return readAuthorizedRecords(db, currentUser.id, patientId)
  }, [currentUser, db])

  const createGrant = useCallback((args: { doctorId: string; scope: GrantScope; expiresAt: string; label?: string; requestId?: string }) => {
    if (!currentUser || currentUser.role !== 'patient') return { ok: false, error: 'Only the patient can grant record access.' }
    const doctor = db.doctors.find(d => d.profileId === args.doctorId)
    if (!doctor) return { ok: false, error: 'Choose a registered doctor.' }
    if (!args.expiresAt || new Date(args.expiresAt).getTime() <= Date.now()) return { ok: false, error: 'Choose an expiry in the future.' }
    if (args.scope.type === 'categories' && args.scope.categories.length === 0) return { ok: false, error: 'Choose at least one category.' }
    if (args.scope.type === 'records' && args.scope.recordIds.length === 0) return { ok: false, error: 'Choose at least one record.' }
    setDb(prev => {
      const grant: SharingGrant = {
        id: uid('grant'), patientId: currentUser.id, doctorId: args.doctorId, scope: args.scope,
        status: 'active', createdAt: todayISO(), expiresAt: args.expiresAt, label: args.label,
      }
      let next = { ...prev, grants: [grant, ...prev.grants] }
      if (args.requestId) {
        next.accessRequests = next.accessRequests.map(r => r.id === args.requestId ? { ...r, status: 'approved', respondedAt: todayISO() } : r)
      }
      return audit(next, 'grant_created', `Granted ${args.scope.type === 'all' ? 'all records' : args.scope.type === 'categories' ? 'selected categories' : 'selected records'} to ${doctor && prev.profiles.find(p => p.id === doctor.profileId)?.name || 'a doctor'} until ${new Date(args.expiresAt).toLocaleString('en-IN')}.`, currentUser.id)
    })
    return { ok: true }
  }, [audit, currentUser, db.doctors])

  const revokeGrant = useCallback((grantId: string) => {
    if (!currentUser || currentUser.role !== 'patient') return { ok: false, error: 'Only the patient can revoke access.' }
    const grant = db.grants.find(g => g.id === grantId && g.patientId === currentUser.id)
    if (!grant) return { ok: false, error: 'Sharing permission was not found.' }
    setDb(prev => {
      const next = { ...prev, grants: prev.grants.map(g => g.id === grantId ? { ...g, status: 'revoked' as const, revokedAt: todayISO() } : g) }
      return audit(next, 'grant_revoked', `Revoked access previously granted to ${prev.profiles.find(p => p.id === grant.doctorId)?.name || 'a doctor'}.`, currentUser.id)
    })
    return { ok: true }
  }, [audit, currentUser, db.grants])

  const createAccessRequest = useCallback((patientIdentifier: string, message = 'Requesting access to selected records for a consultation.') => {
    if (!currentUser || currentUser.role !== 'doctor') return { ok: false, message: 'Doctor account required.' }
    const match = db.patients.find(p => p.patientId.toLowerCase() === patientIdentifier.trim().toLowerCase())
    // Avoid revealing whether a patient identifier exists in this demo flow.
    if (match && !db.accessRequests.some(r => r.patientId === match.profileId && r.doctorId === currentUser.id && r.status === 'pending')) {
      setDb(prev => {
        const request: AccessRequest = { id: uid('request'), doctorId: currentUser.id, patientId: match.profileId, status: 'pending', message, createdAt: todayISO() }
        return audit({ ...prev, accessRequests: [request, ...prev.accessRequests] }, 'request_created', 'Sent a patient access request. No records are visible until the patient grants consent.', match.profileId)
      })
    }
    return { ok: true, message: 'If a matching patient is registered, a request has been sent. No patient records are shown before consent.' }
  }, [audit, currentUser, db.accessRequests, db.patients])

  const respondToRequest = useCallback((requestId: string) => {
    if (!currentUser || currentUser.role !== 'patient') return
    const req = db.accessRequests.find(r => r.id === requestId && r.patientId === currentUser.id && r.status === 'pending')
    if (!req) return
    setDb(prev => {
      const next = { ...prev, accessRequests: prev.accessRequests.map(r => r.id === requestId ? { ...r, status: 'rejected' as const, respondedAt: todayISO() } : r) }
      return audit(next, 'request_responded', 'Declined a doctor access request.', currentUser.id)
    })
  }, [audit, currentUser, db.accessRequests])

  const value: StoreValue = {
    db, currentUser, isDemo: true, mutate, loginDemo, login, register, logout, addAudit,
    getActiveGrant, getDoctorRecords, createGrant, revokeGrant, createAccessRequest, respondToRequest,
  }
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const value = useContext(StoreContext)
  if (!value) throw new Error('useStore must be used within StoreProvider')
  return value
}
