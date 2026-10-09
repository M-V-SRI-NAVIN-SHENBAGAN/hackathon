import { useEffect, useState } from 'react'
import {
  Activity, ArrowRight, ArrowUpRight, BadgeCheck, Bell, BookOpenCheck, CalendarDays, ChevronDown, CircleHelp,
  ClipboardList, FileHeart, FilePlus2, HeartHandshake, HeartPulse, Languages, LockKeyhole, LogOut, Menu,
  MessageSquareText, Search, ShieldCheck, Stethoscope, TriangleAlert, UserRound, UsersRound, X,
} from 'lucide-react'
import { useStore } from './context/Store'
import { useToast } from './context/Toast'
import { DEMO_IDS } from './lib/demo'
import { translate, type Language } from './lib/i18n'
import { Button, Field } from './components/ui'
import { PatientOverview, PatientRecordsPage, PatientTimelinePage, PatientMedicationsPage, PatientHealthPage, PatientSharingPage, PatientAppointmentsPage, PatientEmergencyPage, PatientActivityPage } from './pages/PatientPages'
import { DoctorOverview, DoctorPatientsPage, DoctorRequestsPage, DoctorAppointmentsPage, DoctorActivityPage } from './pages/DoctorPages'

type PortalPage = 'overview' | 'records' | 'timeline' | 'medications' | 'health' | 'sharing' | 'appointments' | 'emergency' | 'activity' | 'patients' | 'requests'
type AuthMode = 'login' | 'signup'

function Logo({ inverse = false }: { inverse?: boolean }) {
  return <div className={`brand ${inverse ? 'brand-inverse' : ''}`}><div className="brand-mark"><HeartPulse size={21} strokeWidth={2.4} /></div><span>Medi<span>Vault</span></span></div>
}

function Landing({ onAuth, onDemo }: { onAuth: (role: 'patient' | 'doctor', mode: AuthMode) => void; onDemo: (id: string) => void }) {
  return <div className="landing-page">
    <div className="landing-nav wrap">
      <Logo />
      <nav className="landing-links"><a href="#how-it-works">How it works</a><a href="#privacy">Privacy & consent</a><a href="#features">Features</a></nav>
      <div className="landing-actions"><button className="link-button" onClick={() => onAuth('patient', 'login')}>Patient login</button><Button variant="outline" size="sm" onClick={() => onAuth('doctor', 'login')}>Doctor login</Button></div>
    </div>

    <main>
      <section className="hero-section wrap">
        <div className="hero-copy">
          <div className="hero-kicker"><span className="live-dot" /> YOUR HEALTH, CONNECTED <span className="demo-chip">FICTIONAL DEMO</span></div>
          <p className="hero-tagline">Your health history. Always with you.</p>
          <h1>Your medical history should follow you, <span>not stay behind with your last doctor.</span></h1>
          <p className="hero-lead">One calm, connected place for your health records — so the right information can travel with you, when you choose to share it.</p>
          <div className="hero-actions"><Button size="lg" onClick={() => onAuth('patient', 'signup')}>Get started <ArrowRight size={17} /></Button><button className="hero-login" onClick={() => onAuth('patient', 'login')}>I already have an account <ArrowUpRight size={15} /></button></div>
          <div className="hero-proof"><div className="avatar-stack"><span>AK</span><span>PR</span><span>KR</span></div><span>Built around your consent,<br /><strong>not someone else’s filing cabinet.</strong></span></div>
        </div>
        <div className="hero-visual" aria-label="Illustration of a connected medical record">
          <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
          <div className="visual-float float-left"><span className="float-icon violet"><Activity size={17} /></span><div><b>Health timeline</b><small>12 months, one view</small></div></div>
          <div className="visual-float float-right"><span className="float-icon green"><ShieldCheck size={17} /></span><div><b>Consent first</b><small>Access you control</small></div></div>
          <div className="record-preview-card">
            <div className="preview-top"><div className="preview-brand"><div className="brand-mark small"><HeartPulse size={14} /></div><span>MediVault</span></div><span className="preview-lock"><LockKeyhole size={13} /> PRIVATE</span></div>
            <div className="preview-patient"><div className="patient-avatar">AK</div><div><b>Arjun Kumar</b><small>Patient ID · MV-2026-0142</small></div><span className="verified-icon"><BadgeCheck size={18} /></span></div>
            <div className="preview-divider" />
            <div className="preview-stat-row"><div><small>RECORDS</small><b>12 <span>documents</span></b></div><div><small>LAST UPDATED</small><b>Today <span>· lab report</span></b></div></div>
            <div className="preview-timeline"><div className="pt-line" /><div className="preview-event"><i className="pt-dot blue-dot" /><span><b>HbA1c — latest result</b><small>Today · Harborview Diagnostics</small></span><span className="event-type">LAB</span></div><div className="preview-event"><i className="pt-dot teal-dot" /><span><b>Medication review</b><small>1 month ago · Northstar Clinic</small></span><span className="event-type">RX</span></div><div className="preview-event"><i className="pt-dot amber-dot" /><span><b>Blood pressure reading</b><small>4 months ago · Northstar Clinic</small></span><span className="event-type">VITAL</span></div></div>
            <div className="preview-consent"><div className="consent-shield"><ShieldCheck size={17} /></div><span><b>Your records, your call</b><small>Grant access by record or category</small></span><ChevronDown size={15} /></div>
          </div>
          <div className="hero-spark spark-one">✳</div><div className="hero-spark spark-two">✳</div>
        </div>
      </section>

      <div className="hero-bottom wrap"><span><ShieldCheck size={15} /> Consent-based sharing</span><i /><span><FileHeart size={15} /> Your records in one timeline</span><i /><span><LockKeyhole size={15} /> Demo data stays in this browser</span></div>

      <section id="features" className="feature-section wrap section-pad">
        <div className="section-heading"><div className="eyebrow">A BETTER WAY TO CARRY YOUR HISTORY</div><h2>Health records, without the runaround.</h2><p>Medical information often gets stranded across disconnected providers. MediVault brings the pieces together and keeps you in control of who can see them.</p></div>
        <div className="feature-grid">
          <article className="feature-card"><div className="feature-icon blue-bg"><FileHeart size={21} /></div><h3>One connected vault</h3><p>Prescriptions, lab reports, scans and more, organized in one searchable place.</p><a href="#how-it-works">Explore the timeline <ArrowRight size={14} /></a></article>
          <article className="feature-card"><div className="feature-icon teal-bg"><HeartHandshake size={21} /></div><h3>Share only what matters</h3><p>Choose a doctor, specific records or categories, and exactly when access ends.</p><a href="#privacy">See how consent works <ArrowRight size={14} /></a></article>
          <article className="feature-card"><div className="feature-icon amber-bg"><Activity size={21} /></div><h3>History with context</h3><p>Keep results and visits in date order, with comparisons that point back to source records.</p><a href="#how-it-works">See the workflow <ArrowRight size={14} /></a></article>
        </div>
      </section>

      <section id="how-it-works" className="workflow-section section-pad"><div className="wrap workflow-inner"><div className="workflow-copy"><div className="eyebrow">SIMPLE BY DESIGN</div><h2>Three steps.<br /><span>More continuity.</span></h2><p>Start with your own records. Choose what to share. Revoke access when you’re done.</p><Button variant="outline" onClick={() => onAuth('patient', 'signup')}>Create your demo account <ArrowRight size={16} /></Button></div><div className="workflow-steps"><div className="workflow-step"><span className="step-number">01</span><div className="step-icon"><FilePlus2 size={20} /></div><div><h3>Bring records together</h3><p>Upload or organize reports, prescriptions and visits in one personal vault.</p></div></div><div className="workflow-step"><span className="step-number">02</span><div className="step-icon"><UserRound size={20} /></div><div><h3>Pick who can see them</h3><p>Find a registered doctor and share only the records or categories they need.</p></div></div><div className="workflow-step"><span className="step-number">03</span><div className="step-icon"><ShieldCheck size={20} /></div><div><h3>Stay in control</h3><p>Set an expiry, review the activity, or revoke a grant immediately.</p></div></div></div></div></section>

      <section id="privacy" className="privacy-section wrap section-pad"><div className="privacy-card"><div className="privacy-art"><div className="privacy-circle"><ShieldCheck size={35} /></div><span className="privacy-orbit-dot dot-a" /><span className="privacy-orbit-dot dot-b" /><span className="privacy-orbit-dot dot-c" /></div><div className="privacy-copy"><div className="eyebrow">PRIVACY IS A PRODUCT FEATURE</div><h2>Your records don’t move<br />without your say-so.</h2><p>Doctors cannot browse a global patient directory or view records just by signing in. In this demo, access is checked against active grants and their scope every time records are opened.</p><div className="privacy-points"><span><CheckMark /> You decide what is shared</span><span><CheckMark /> Access is time-limited</span><span><CheckMark /> Revocation is immediate in the demo</span></div><small className="privacy-note">Important: This hackathon prototype uses local browser storage and is not a secure medical record system. Never enter real patient information.</small></div></div></section>

      <section className="demo-callout wrap"><div><div className="eyebrow">READY TO EXPLORE?</div><h2>Try the complete patient-to-doctor workflow.</h2><p>Fictional sample records, fictional clinicians and one-click demo access.</p></div><div className="demo-callout-actions"><Button onClick={() => onDemo(DEMO_IDS.patient)}>Enter as patient <ArrowRight size={15} /></Button><button className="link-button" onClick={() => onAuth('doctor', 'login')}>Open doctor portal</button></div></section>
    </main>
    <footer className="landing-footer wrap"><Logo /><span>© 2026 MediVault · Hackathon demonstration only</span><span className="footer-disclaimer">Not medical advice · Not a certified clinical system</span></footer>
  </div>
}

function CheckMark() { return <span className="check-mark"><BadgeCheck size={15} /></span> }

function AuthScreen({ role: initialRole, mode: initialMode, onBack, onMode, onRole, onDemo }: { role: 'patient' | 'doctor'; mode: AuthMode; onBack: () => void; onMode: (m: AuthMode) => void; onRole: (r: 'patient' | 'doctor') => void; onDemo: (id: string) => void }) {
  const { login, register } = useStore()
  const toast = useToast()
  const [role, setRole] = useState(initialRole)
  const [mode, setMode] = useState(initialMode)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', password: '', dob: '', gender: '', phone: '', specialization: '', hospital: '', registrationNumber: '' })
  const [showPassword, setShowPassword] = useState(false)
  const update = (key: keyof typeof form, val: string) => setForm(prev => ({ ...prev, [key]: val }))

  const setModeBoth = (next: AuthMode) => { setMode(next); onMode(next); setError('') }
  const setRoleBoth = (next: 'patient' | 'doctor') => { setRole(next); onRole(next); setError('') }
  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    if (mode === 'signup') {
      if (!form.name.trim()) return setError('Enter your full name.')
      if (form.password.length < 8) return setError('Use a password with at least 8 characters.')
      if (role === 'patient' && !form.dob) return setError('Enter your date of birth.')
      if (role === 'patient' && form.dob > new Date().toISOString().slice(0, 10)) return setError('Date of birth cannot be in the future.')
      if (role === 'patient' && !form.phone.trim()) return setError('Enter a phone number.')
      if (role === 'patient' && form.phone.replace(/\D/g, '').length < 7) return setError('Enter a valid phone number.')
      if (role === 'doctor' && (!form.specialization.trim() || !form.hospital.trim() || !form.registrationNumber.trim())) return setError('Complete your professional details.')
    }
    setBusy(true)
    await new Promise(resolve => setTimeout(resolve, 320))
    if (mode === 'login') {
      const result = await login(form.email, form.password, role)
      setBusy(false)
      if (!result.ok) return setError(result.error || 'Something went wrong.')
    } else {
      const result = await register({ ...form, role })
      setBusy(false)
      if (!result.ok) return setError(result.error || 'Something went wrong.')
      if (result.patientId) toast(`Your demo patient ID is ${result.patientId}. Keep it handy.`)
    }
  }

  return <div className="auth-page">
    <header className="auth-header wrap"><button className="back-link" onClick={onBack}>← <span>Back to home</span></button><Logo /><span className="auth-secure"><ShieldCheck size={15} /> Demo access</span></header>
    <main className="auth-main wrap"><div className="auth-decoration"><div className="auth-decor-label"><span className="live-dot" /> A MORE CONNECTED HEALTH HISTORY</div><h1>Care feels better<br />when context<br /><span>comes along.</span></h1><p>Your records, your timeline, your permission. Explore the demo with fictional data.</p><div className="auth-decor-card"><div className="mini-shield"><LockKeyhole size={17} /></div><div><b>Consent is always yours</b><small>Share less. Revoke anytime.</small></div><ShieldCheck size={18} className="auth-check" /></div><div className="auth-decor-blob" /></div>
      <div className="auth-card"><div className="auth-card-heading"><div className="eyebrow">MEDIVAULT DEMO</div><h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2><p>{mode === 'login' ? 'Choose your portal and continue.' : 'Start a local demo profile in a few steps.'}</p></div>
        <div className="role-toggle" aria-label="Select account role"><button className={role === 'patient' ? 'active' : ''} onClick={() => setRoleBoth('patient')}><UserRound size={16} /> Patient</button><button className={role === 'doctor' ? 'active' : ''} onClick={() => setRoleBoth('doctor')}><Stethoscope size={16} /> Doctor</button></div>
        <form className="auth-form" onSubmit={submit}>
          {mode === 'signup' && <Field label="Full name" required><input value={form.name} onChange={e => update('name', e.target.value)} placeholder={role === 'doctor' ? 'Dr. Your Name' : 'Your name'} autoComplete="name" /></Field>}
          {mode === 'signup' && role === 'patient' && <div className="form-grid"><Field label="Date of birth" required><input type="date" max={new Date().toISOString().slice(0, 10)} value={form.dob} onChange={e => update('dob', e.target.value)} /></Field><Field label="Gender (optional)"><select value={form.gender} onChange={e => update('gender', e.target.value)}><option value="">Prefer not to say</option><option>Female</option><option>Male</option><option>Non-binary</option><option>Self-described</option></select></Field></div>}
          {mode === 'signup' && role === 'patient' && <Field label="Phone number" required><input type="tel" value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="+91 98765 43210" autoComplete="tel" /></Field>}
          {mode === 'signup' && role === 'doctor' && <><Field label="Medical specialization" required><input value={form.specialization} onChange={e => update('specialization', e.target.value)} placeholder="e.g. General Physician" /></Field><Field label="Hospital or clinic" required><input value={form.hospital} onChange={e => update('hospital', e.target.value)} placeholder="Organization name" /></Field><Field label="Professional registration number" required hint="Demo field only — not verified."><input value={form.registrationNumber} onChange={e => update('registrationNumber', e.target.value)} placeholder="Registration number" /></Field></>}
          <Field label="Email address" required><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" required /></Field>
          <Field label="Password" required hint={mode === 'signup' ? 'At least 8 characters.' : undefined}><div className="password-input"><input type={showPassword ? 'text' : 'password'} value={form.password} onChange={e => update('password', e.target.value)} placeholder="••••••••" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} required minLength={mode === 'signup' ? 8 : undefined} /><button type="button" onClick={() => setShowPassword(s => !s)}>{showPassword ? 'Hide' : 'Show'}</button></div></Field>
          {error && <div className="form-error"><TriangleAlert size={15} /> {error}</div>}
          <Button type="submit" size="lg" className="auth-submit" disabled={busy}>{busy ? <><span className="spinner" /> {mode === 'login' ? 'Signing in…' : 'Creating account…'}</> : <>{mode === 'login' ? 'Continue' : 'Create demo account'} <ArrowRight size={16} /></>}</Button>
        </form>
        <div className="auth-mode-switch">{mode === 'login' ? <>New to MediVault? <button onClick={() => setModeBoth('signup')}>Create a demo account</button></> : <>Already have an account? <button onClick={() => setModeBoth('login')}>Sign in</button></>}</div>
        <div className="auth-divider"><span>or explore with one-click demo access</span></div>
        <div className="demo-login-list">
          {role === 'patient' ? <button className="demo-login" onClick={() => onDemo(DEMO_IDS.patient)}><span className="demo-avatar patient-demo">AK</span><span><b>Arjun Kumar</b><small>Patient portal · fictional account</small></span><ArrowRight size={16} /></button> : <><button className="demo-login" onClick={() => onDemo(DEMO_IDS.priya)}><span className="demo-avatar doctor-demo"><Stethoscope size={17} /></span><span><b>Dr. Priya Raman</b><small>General Physician · Northstar Clinic</small></span><ArrowRight size={16} /></button><button className="demo-login" onClick={() => onDemo(DEMO_IDS.karthik)}><span className="demo-avatar doctor-demo"><Stethoscope size={17} /></span><span><b>Dr. Karthik Raj</b><small>Endocrinologist · CityCare Medical Centre</small></span><ArrowRight size={16} /></button></>}
        </div>
        <div className="auth-demo-note"><LockKeyhole size={13} /> Demo profiles are fictional. No credentials are displayed or required.</div>
      </div>
    </main>
    <footer className="auth-footer wrap">MediVault · Local browser demo only · Never use real medical data</footer>
  </div>
}

function getNav(role: 'patient' | 'doctor', t: (key: Parameters<typeof translate>[1]) => string) {
  if (role === 'patient') return [
    { label: t('overview'), id: 'overview' as PortalPage, icon: Activity, section: 'PERSONAL HEALTH' },
    { label: t('records'), id: 'records' as PortalPage, icon: FileHeart },
    { label: t('timeline'), id: 'timeline' as PortalPage, icon: ClipboardList },
    { label: t('medications'), id: 'medications' as PortalPage, icon: HeartPulse },
    { label: t('health'), id: 'health' as PortalPage, icon: UserRound, section: 'YOUR CARE' },
    { label: t('sharing'), id: 'sharing' as PortalPage, icon: HeartHandshake },
    { label: t('appointments'), id: 'appointments' as PortalPage, icon: CalendarDays },
    { label: t('emergency'), id: 'emergency' as PortalPage, icon: ShieldCheck, section: 'TOOLS' },
    { label: t('activity'), id: 'activity' as PortalPage, icon: BookOpenCheck },
  ]
  return [
    { label: t('overview'), id: 'overview' as PortalPage, icon: Activity, section: 'CLINICAL DESK' },
    { label: t('patients'), id: 'patients' as PortalPage, icon: UsersRound },
    { label: t('requests'), id: 'requests' as PortalPage, icon: HeartHandshake, section: 'WORK QUEUE' },
    { label: t('appointments'), id: 'appointments' as PortalPage, icon: CalendarDays },
    { label: t('activity'), id: 'activity' as PortalPage, icon: BookOpenCheck, section: 'TOOLS' },
  ]
}

function AppShell({ language, setLanguage, page, setPage, globalSearch, setGlobalSearch }: { language: Language; setLanguage: (l: Language) => void; page: PortalPage; setPage: (p: PortalPage) => void; globalSearch: string; setGlobalSearch: (v: string) => void }) {
  const { currentUser, db, logout } = useStore()
  const toast = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  if (!currentUser) return null
  const patient = currentUser.role === 'patient'
  const nav = getNav(currentUser.role, key => translate(language, key))
  const patientMeta = db.patients.find(p => p.profileId === currentUser.id)
  const doctorMeta = db.doctors.find(d => d.profileId === currentUser.id)
  const pendingCount = patient
    ? db.accessRequests.filter(r => r.patientId === currentUser.id && r.status === 'pending').length
    : db.accessRequests.filter(r => r.doctorId === currentUser.id && r.status === 'pending').length
  const pageNames: Record<PortalPage, string> = {
    overview: translate(language, 'overview'), records: translate(language, 'records'), timeline: translate(language, 'timeline'), medications: translate(language, 'medications'), health: translate(language, 'health'), sharing: translate(language, 'sharing'), appointments: translate(language, 'appointments'), emergency: translate(language, 'emergency'), activity: translate(language, 'activity'), patients: translate(language, 'patients'), requests: translate(language, 'requests'),
  }
  const doLogout = () => { logout(); setPage('overview'); toast('You have been signed out.'); }
  return <div className="app-shell">
    {menuOpen && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Logo /><button className="mobile-close" aria-label="Close navigation" onClick={() => setMenuOpen(false)}><X size={18} /></button></div>
      <div className="portal-switcher"><div className={`portal-avatar ${patient ? 'portal-avatar-patient' : ''}`}>{patient ? <UserRound size={16} /> : <Stethoscope size={16} />}</div><div><b>{patient ? 'Patient portal' : 'Doctor portal'}</b><small>{patient ? 'Your personal health space' : (doctorMeta?.specialization || 'Clinical workspace')}</small></div><ChevronDown size={14} className="portal-chevron" /></div>
      <div className="nav-label">WORKSPACE</div>
      <nav className="side-nav">{nav.map((item, index) => <div key={item.id}>{item.section && <div className={`nav-section-label ${index > 0 ? 'nav-section-gap' : ''}`}>{item.section}</div>}<button className={`nav-item ${page === item.id ? 'nav-item-active' : ''}`} onClick={() => { setPage(item.id); setMenuOpen(false) }}><item.icon size={18} strokeWidth={1.8} /><span>{item.label}</span>{item.id === 'sharing' && pendingCount > 0 || item.id === 'requests' && pendingCount > 0 ? <span className="nav-count">{pendingCount}</span> : null}</button></div>)}</nav>
      <div className="sidebar-bottom"><div className="demo-side-note"><span className="demo-indicator"><i /> DEMO DATA</span><p>Fictional patient information. Saved in this browser only.</p><button onClick={() => toast('Demo reset is available from the landing page by clearing this browser’s site data.', 'info')}>About demo storage <CircleHelp size={13} /></button></div><button className="sidebar-user" onClick={() => setProfileOpen(!profileOpen)}><div className="user-avatar">{currentUser.name.split(' ').map(s => s[0]).slice(0, 2).join('')}</div><span><b>{currentUser.name}</b><small>{patient ? patientMeta?.patientId : doctorMeta?.hospital}</small></span><ChevronDown size={15} /></button>{profileOpen && <div className="profile-popover"><button onClick={() => { setProfileOpen(false); toast(patient ? `Patient ID ${patientMeta?.patientId}` : `${doctorMeta?.specialization} · ${doctorMeta?.registrationNumber}`, 'info') }}><UserRound size={15} /> View profile</button><button onClick={doLogout}><LogOut size={15} /> {translate(language, 'signOut')}</button></div>}</div>
    </aside>
    <div className="main-column">
      <header className="topbar"><div className="topbar-left"><button className="menu-toggle" onClick={() => setMenuOpen(true)} aria-label="Open navigation"><Menu size={20} /></button><div className="breadcrumb"><span>{patient ? 'Personal health' : 'Clinical desk'}</span><span className="crumb-divider">/</span><b>{pageNames[page]}</b></div></div><div className="topbar-right"><div className="top-search"><Search size={15} /><input value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} onFocus={() => setSearchOpen(true)} onKeyDown={e => { if (e.key === 'Enter') { setPage(patient ? 'records' : 'patients'); setSearchOpen(false) } }} placeholder={patient ? 'Search records…' : 'Search authorized patients…'} />{searchOpen && globalSearch && <button aria-label="Run search" onClick={() => { setPage(patient ? 'records' : 'patients'); setSearchOpen(false) }}><ArrowRight size={15} /></button>}</div><span className="top-demo-pill"><i /> {translate(language, 'demo')}</span><label className="language-select"><Languages size={15} /><select value={language} aria-label="Select language" onChange={e => setLanguage(e.target.value as Language)}><option value="en">EN</option><option value="ta">தமிழ்</option></select></label><button className="top-icon-button" aria-label="Open activity" onClick={() => setPage('activity')}><Bell size={18} />{pendingCount > 0 && <i />}</button><button className="top-mobile-avatar" onClick={() => setProfileOpen(!profileOpen)}>{currentUser.name.charAt(0)}</button></div></header>
      <main className="app-content">
        {page === 'overview' && (patient ? <PatientOverview onNavigate={setPage} /> : <DoctorOverview onNavigate={setPage} />)}
        {page === 'records' && patient && <PatientRecordsPage globalSearch={globalSearch} clearGlobalSearch={() => setGlobalSearch('')} />}
        {page === 'timeline' && patient && <PatientTimelinePage />}
        {page === 'medications' && patient && <PatientMedicationsPage />}
        {page === 'health' && patient && <PatientHealthPage />}
        {page === 'sharing' && patient && <PatientSharingPage />}
        {page === 'appointments' && (patient ? <PatientAppointmentsPage /> : <DoctorAppointmentsPage />)}
        {page === 'emergency' && patient && <PatientEmergencyPage />}
        {page === 'activity' && (patient ? <PatientActivityPage /> : <DoctorActivityPage />)}
        {page === 'patients' && !patient && <DoctorPatientsPage globalSearch={globalSearch} clearGlobalSearch={() => setGlobalSearch('')} />}
        {page === 'requests' && !patient && <DoctorRequestsPage />}
      </main>
      <footer className="app-footer"><span><ShieldCheck size={13} /> Demo access checks are simulated in this browser.</span><span>{translate(language, 'disclaimer')}</span></footer>
    </div>
  </div>
}

export default function App() {
  const { currentUser, loginDemo, logout } = useStore()
  const emergencyRoute = typeof window !== 'undefined' && window.location.hash.startsWith('#emergency/')
  const [auth, setAuth] = useState<{ role: 'patient' | 'doctor'; mode: AuthMode } | null>(() => emergencyRoute ? { role: 'doctor', mode: 'login' } : null)
  const [page, setPage] = useState<PortalPage>('overview')
  const [language, setLanguage] = useState<Language>('en')
  const [globalSearch, setGlobalSearch] = useState('')
  useEffect(() => {
    const handler = (event: Event) => {
      const target = (event as CustomEvent<string>).detail
      if (target) setPage(target as PortalPage)
    }
    window.addEventListener('medivault:navigate', handler)
    return () => window.removeEventListener('medivault:navigate', handler)
  }, [])
  const openDemo = (id: string) => { loginDemo(id); setPage(emergencyRoute && id !== DEMO_IDS.patient ? 'requests' : 'overview'); setAuth(null) }
  useEffect(() => {
    if (!emergencyRoute) return
    if (currentUser?.role === 'patient') { logout(); setAuth({ role: 'doctor', mode: 'login' }) }
    else if (currentUser?.role === 'doctor') setPage('requests')
  }, [emergencyRoute, currentUser, logout])
  const enterAuth = (role: 'patient' | 'doctor', mode: AuthMode) => setAuth({ role, mode })
  const setAuthRole = (role: 'patient' | 'doctor') => setAuth(prev => prev ? { ...prev, role } : prev)
  const setAuthMode = (mode: AuthMode) => setAuth(prev => prev ? { ...prev, mode } : prev)

  return <>
    {!currentUser && !auth && <Landing onAuth={enterAuth} onDemo={openDemo} />}
    {!currentUser && auth && <AuthScreen role={auth.role} mode={auth.mode} onBack={() => { if (emergencyRoute) window.location.hash = ''; setAuth(null) }} onMode={setAuthMode} onRole={setAuthRole} onDemo={openDemo} />}
    {currentUser && <AppShell language={language} setLanguage={setLanguage} page={page} setPage={setPage} globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} />}
  </>
}
