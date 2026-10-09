import React, { useEffect, useMemo, useState } from 'react'
import {
  Activity, AlertCircle, ArrowDownToLine, ArrowRight, ArrowUpRight, BellRing, BookOpenCheck, CalendarDays, Check, CheckCircle2, ChevronDown,
  ChevronRight, ClipboardCheck, Clock3, FileCheck2, FileHeart, FilePlus2, FileText, Filter, HeartHandshake,
  HeartPulse, Info, ListFilter, LockKeyhole, MessageSquareText, MoreHorizontal, Pencil, Plus, Search, ShieldAlert, ShieldCheck,
  Stethoscope, Trash2, Upload, UserRound, UsersRound, X,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { QRCodeSVG } from 'qrcode.react'
import { useStore } from '../context/Store'
import { useToast } from '../context/Toast'
import { CATEGORY_LABELS } from '../lib/demo'
import type { AccessRequest, Allergy, Appointment, GrantScope, MedicalRecord, Medication, RecordCategory, Surgery } from '../lib/types'
import { dateOnly, fileExt, fmtDate, fmtDateTime, isExpired, normalize, readFileAsDataURL, uid } from '../lib/utils'
import { Badge, Button, EmptyState, Field, Modal, PageTitle } from '../components/ui'

const categories = Object.entries(CATEGORY_LABELS) as [RecordCategory, string][]

function HealthMetric({ icon, label, value, detail, tone, onClick }: { icon: React.ReactNode; label: string; value: string | number; detail: string; tone: string; onClick?: () => void }) {
  return <button className={`health-metric metric-${tone}`} onClick={onClick}><span className="metric-icon">{icon}</span><span className="metric-copy"><small>{label}</small><strong>{value}</strong><span>{detail}</span></span><ChevronRight className="metric-arrow" size={16} /></button>
}

function initials(name: string) { return name.split(' ').map(word => word[0]).slice(0, 2).join('').toUpperCase() }
function getProfileName(db: ReturnType<typeof useStore>['db'], id: string) { return db.profiles.find(p => p.id === id)?.name || 'Healthcare provider' }
function isDuplicateRecord(record: MedicalRecord, all: MedicalRecord[]) {
  return all.some(other => other.id !== record.id && other.patientId === record.patientId && other.category === record.category && Math.abs(new Date(other.date).getTime() - new Date(record.date).getTime()) < 1000 * 60 * 60 * 24 * 3 && other.provider.trim().toLowerCase() === record.provider.trim().toLowerCase() && (
    normalize(other.title.replace(/duplicate|copy/gi, '')) === normalize(record.title.replace(/duplicate|copy/gi, '')) ||
    (record.labResults?.length && other.labResults?.some(a => record.labResults?.some(b => normalize(a.test) === normalize(b.test))))
  ))
}

function printableSummary(name: string, patientId: string, data: { allergies: Allergy[]; meds: Medication[]; conditions: { condition: string; confirmed: boolean; recordedBy: string }[]; records: MedicalRecord[]; surgeries: Surgery[]; emergencyContact: string }) {
  const esc = (value: string) => value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char] || char))
  const allergyRows = data.allergies.map(a => `<li>${esc(a.allergen)} — ${esc(a.reaction || 'reaction not recorded')} (${a.confirmed ? 'clinician-confirmed' : 'patient-reported'})</li>`).join('') || '<li>No allergies recorded</li>'
  const conditionRows = data.conditions.map(c => `<li>${esc(c.condition)} (${c.confirmed ? 'clinician-confirmed' : 'patient-reported'} · ${esc(c.recordedBy)})</li>`).join('') || '<li>No conditions recorded</li>'
  const medRows = data.meds.map(m => `<li>${esc(m.name)} · ${esc(m.dose || 'dose not recorded')} · ${m.status}</li>`).join('') || '<li>No medications recorded</li>'
  const recentRows = data.records.slice(0, 8).map(r => `<li>${fmtDate(r.date)} · ${esc(r.title)} · ${esc(r.provider)}</li>`).join('')
  const surgeryRows = data.surgeries.map(s => `<li>${esc(s.procedure)} · ${fmtDate(s.date)} · ${esc(s.hospital || 'provider not recorded')}</li>`).join('') || '<li>No previous procedures recorded</li>'
  const html = `<!doctype html><html><head><title>MediVault health summary</title><meta charset="utf-8"><style>body{font:15px/1.5 Arial,sans-serif;color:#142d45;max-width:780px;margin:48px auto;padding:0 28px}h1{font-size:28px;margin-bottom:4px}h2{font-size:16px;border-bottom:1px solid #d9e4eb;padding-bottom:7px;margin-top:28px}.meta,.muted{color:#65798b;font-size:13px}.notice{padding:12px 14px;background:#fff7e8;border:1px solid #f0d9a8;border-radius:8px;margin:20px 0}.foot{margin-top:36px;border-top:1px solid #d9e4eb;padding-top:14px;color:#65798b;font-size:12px}@media print{body{margin:18mm auto}}</style></head><body><div class="meta">MEDIVAULT · PATIENT-OWNED HEALTH SUMMARY · ${new Date().toLocaleDateString('en-IN')}</div><h1>${esc(name)}</h1><div class="meta">Patient ID · ${esc(patientId)}</div><div class="notice">This is a fictional hackathon demo export, not medical advice or a certified clinical record. Please verify all information with the patient and treating clinician.</div><h2>Recorded conditions</h2><ul>${conditionRows}</ul><h2>Previous procedures</h2><ul>${surgeryRows}</ul><h2>Allergies</h2><ul>${allergyRows}</ul><h2>Medications</h2><ul>${medRows}</ul><h2>Emergency contact</h2><p>${esc(data.emergencyContact || 'Not recorded')}</p><h2>Recent records</h2><ul>${recentRows || '<li>No records</li>'}</ul><div class="foot">Patient-reported details are labeled separately from clinician-confirmed entries. Source details are shown above where available. Generated by MediVault demo.</div><script>window.onload=()=>setTimeout(()=>window.print(),250)</script></body></html>`
  const win = window.open('', '_blank', 'width=780,height=860')
  if (!win) return false
  win.document.open(); win.document.write(html); win.document.close()
  return true
}

export function PatientOverview({ onNavigate }: { onNavigate: (page: any) => void }) {
  const { db, currentUser, respondToRequest } = useStore()
  const toast = useToast()
  if (!currentUser) return null
  const profile = db.patients.find(p => p.profileId === currentUser.id)
  const records = db.records.filter(r => r.patientId === currentUser.id).sort((a, b) => b.date.localeCompare(a.date))
  const activeMeds = db.medications.filter(m => m.patientId === currentUser.id && m.status === 'active')
  const pending = db.accessRequests.filter(r => r.patientId === currentUser.id && r.status === 'pending')
  const nextAppointment = db.appointments.filter(a => a.patientId === currentUser.id && ['proposed', 'accepted'].includes(a.status)).sort((a, b) => a.dateTime.localeCompare(b.dateTime))[0]
  const a1c = records.filter(r => r.labResults?.some(l => normalize(l.test).includes('hba1c'))).sort((a, b) => a.date.localeCompare(b.date)).map(r => ({ date: new Date(r.date).toLocaleDateString('en-IN', { month: 'short' }), value: r.labResults?.find(l => normalize(l.test).includes('hba1c'))?.numericValue || 0 }))
  const firstName = currentUser.name.split(' ')[0]
  const doctor = nextAppointment ? getProfileName(db, nextAppointment.doctorId) : ''
  return <div className="page-stack">
    <div className="patient-welcome"><div><div className="welcome-eyebrow"><span className="live-dot" /> YOUR HEALTH, IN ONE PLACE</div><h1>Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {firstName}<span className="greeting-wave">✳</span></h1><p>Your records are yours to carry. Here’s what’s new in your health vault.</p><div className="patient-id-chip"><UserRound size={14} /> Patient ID <b>{profile?.patientId}</b><span className="id-demo-label">DEMO</span></div></div><div className="welcome-illustration"><div className="welcome-ring ring-a" /><div className="welcome-ring ring-b" /><div className="welcome-shield"><HeartPulse size={31} /></div><span className="welcome-float float-record"><FileHeart size={15} /> <b>{records.length}</b><small>records</small></span><span className="welcome-float float-health"><ShieldCheck size={15} /> Yours to share</span></div></div>
    <div className="quick-actions"><button onClick={() => onNavigate('records')}><span className="quick-icon q-blue"><Upload size={17} /></span><span><b>Upload record</b><small>Add a new document</small></span><ArrowRight size={15} /></button><button onClick={() => onNavigate('medications')}><span className="quick-icon q-green"><Plus size={18} /></span><span><b>Add medication</b><small>Update your list</small></span><ArrowRight size={15} /></button><button onClick={() => onNavigate('sharing')}><span className="quick-icon q-purple"><HeartHandshake size={17} /></span><span><b>Share records</b><small>Choose a doctor</small></span><ArrowRight size={15} /></button><button onClick={() => onNavigate('timeline')}><span className="quick-icon q-amber"><Activity size={17} /></span><span><b>View timeline</b><small>See your history</small></span><ArrowRight size={15} /></button></div>
    <div className="metric-grid"><HealthMetric icon={<FileHeart size={20} />} label="MEDICAL RECORDS" value={records.length} detail="Across your health history" tone="blue" onClick={() => onNavigate('records')} /><HealthMetric icon={<HeartPulse size={20} />} label="ACTIVE MEDICATIONS" value={activeMeds.length} detail="Check with your clinician" tone="teal" onClick={() => onNavigate('medications')} /><HealthMetric icon={<CalendarDays size={20} />} label="UPCOMING VISIT" value={nextAppointment ? fmtDate(nextAppointment.dateTime) : 'None'} detail={nextAppointment ? `with ${doctor}` : 'No appointment planned'} tone="purple" onClick={() => onNavigate('appointments')} /><HealthMetric icon={<BellRing size={20} />} label="ACCESS REQUESTS" value={pending.length} detail={pending.length ? 'Needs your review' : 'You’re all caught up'} tone="amber" onClick={() => onNavigate('sharing')} /></div>
    <div className="dashboard-grid">
      <section className="panel chart-panel"><div className="panel-heading"><div><div className="eyebrow">YOUR TEST HISTORY</div><h2>HbA1c results</h2></div><Badge tone="blue">Fictional sample</Badge></div>{a1c.length > 1 ? <><div className="chart-summary"><strong>{a1c[a1c.length - 1].value.toFixed(1)}<small>%</small></strong><span>Latest recorded<br />{records.find(r => r.labResults?.some(l => normalize(l.test).includes('hba1c')) && r.date === records.filter(x => x.labResults?.some(l => normalize(l.test).includes('hba1c'))).sort((a,b)=>b.date.localeCompare(a.date))[0]?.date)?.date ? fmtDate(records.filter(r => r.labResults?.some(l => normalize(l.test).includes('hba1c'))).sort((a,b)=>b.date.localeCompare(a.date))[0].date) : ''}</span><span className="chart-source"><Info size={13} /> Values shown as recorded; verify with a clinician.</span></div><div className="chart-wrap"><ResponsiveContainer width="100%" height={188}><AreaChart data={a1c} margin={{ top: 12, right: 12, bottom: 0, left: -18 }}><defs><linearGradient id="a1cFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#2389bb" stopOpacity={0.2} /><stop offset="95%" stopColor="#2389bb" stopOpacity={0.015} /></linearGradient></defs><CartesianGrid stroke="#edf2f6" vertical={false} /><XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fill: '#8292a3', fontSize: 11 }} dy={9} /><YAxis domain={['dataMin - 0.5', 'dataMax + 0.5']} axisLine={false} tickLine={false} tick={{ fill: '#8292a3', fontSize: 11 }} /><Tooltip contentStyle={{ borderRadius: 12, borderColor: '#e2eaf0', fontSize: 12 }} formatter={(value: number) => [`${value.toFixed(1)}%`, 'HbA1c']} /><Area type="monotone" dataKey="value" stroke="#2088b7" strokeWidth={2.6} fill="url(#a1cFill)" activeDot={{ r: 5, fill: '#2088b7', stroke: 'white', strokeWidth: 2 }} /></AreaChart></ResponsiveContainer></div><div className="panel-footnote"><span><i className="legend-dot" /> HbA1c · %</span><button className="text-action" onClick={() => onNavigate('timeline')}>See all results <ArrowRight size={14} /></button></div></> : <EmptyState icon={<Activity size={23} />} title="No trend data yet" description="Lab reports with numeric results will appear here." />}</section>
      <section className="panel recent-panel"><div className="panel-heading"><div><div className="eyebrow">LATEST ADDITIONS</div><h2>Recent records</h2></div><button className="icon-button" onClick={() => onNavigate('records')} aria-label="View all records"><ArrowRight size={17} /></button></div><div className="recent-record-list">{records.slice(0, 4).map(record => <button className="recent-record-row" key={record.id} onClick={() => onNavigate('records')}><span className={`record-type-icon type-${record.category}`}><FileText size={17} /></span><span className="recent-record-info"><b>{record.title}</b><small>{record.provider} · {fmtDate(record.date)}</small></span><ChevronRight size={15} /></button>)}{records.length === 0 && <EmptyState icon={<FileHeart size={23} />} title="Your vault is ready" description="Upload your first record to get started." action={<Button size="sm" onClick={() => onNavigate('records')}>Upload a record</Button>} />}</div><button className="panel-link-button" onClick={() => onNavigate('records')}>View all records <ArrowRight size={14} /></button></section>
    </div>
    <div className="dashboard-grid lower-dashboard">
      <section className="panel request-panel"><div className="panel-heading"><div><div className="eyebrow">CONSENT CENTER</div><h2>Doctor access requests</h2></div><span className="count-bubble">{pending.length}</span></div>{pending.length ? <div className="dashboard-request-list">{pending.map(request => <RequestCard key={request.id} request={request} compact />)}</div> : <div className="inline-empty"><CheckCircle2 size={19} /><span><b>No pending requests</b><small>New doctor requests will appear here for your review.</small></span></div>}<button className="panel-link-button" onClick={() => onNavigate('sharing')}>Manage sharing permissions <ArrowRight size={14} /></button></section>
      <section className="next-visit-card"><div className="visit-top"><span className="visit-icon"><CalendarDays size={19} /></span><Badge tone={nextAppointment?.status === 'proposed' ? 'amber' : 'green'}>{nextAppointment?.status || 'planned'}</Badge></div><div className="eyebrow">NEXT APPOINTMENT</div>{nextAppointment ? <><h2>{doctor}</h2><p>{db.doctors.find(d => d.profileId === nextAppointment.doctorId)?.specialization} · {nextAppointment.clinic}</p><div className="visit-date"><CalendarDays size={15} /> {fmtDateTime(nextAppointment.dateTime)}</div><button onClick={() => onNavigate('appointments')}>View appointment <ArrowRight size={14} /></button></> : <><h2>No appointment scheduled</h2><p>Simulated appointments will appear when proposed.</p><button onClick={() => onNavigate('appointments')}>View appointments <ArrowRight size={14} /></button></>}</section>
    </div>
    <div className="fictional-notice"><Info size={14} /><span>All sample health data is fictional and for product demonstration only. Do not use this demo for medical decisions.</span></div>
  </div>
}

function RequestCard({ request, compact = false }: { request: AccessRequest; compact?: boolean }) {
  const { db, respondToRequest } = useStore()
  const toast = useToast()
  const doctor = db.profiles.find(p => p.id === request.doctorId)
  const metadata = db.doctors.find(d => d.profileId === request.doctorId)
  return <div className={`request-card ${compact ? 'request-card-compact' : ''}`}><div className="request-doctor-avatar"><Stethoscope size={17} /></div><div className="request-copy"><b>{doctor?.name || 'Registered doctor'}</b><small>{metadata?.specialization} · {metadata?.hospital}</small><p>{request.message}</p><span><Clock3 size={12} /> Requested {fmtDateTime(request.createdAt)}</span></div><div className="request-actions"><Button size="sm" variant="outline" onClick={() => window.dispatchEvent(new CustomEvent('medivault:navigate', { detail: 'sharing' }))}>Review access</Button><Button size="sm" variant="outline" onClick={() => { respondToRequest(request.id); toast('Access request declined.') }}>Decline</Button></div></div>
}

export function PatientRecordsPage({ globalSearch = '', clearGlobalSearch }: { globalSearch?: string; clearGlobalSearch?: () => void }) {
  const { db, currentUser, mutate, addAudit } = useStore()
  const toast = useToast()
  const [search, setSearch] = useState(globalSearch)
  const [category, setCategory] = useState('all')
  const [provider, setProvider] = useState('all')
  const [doctorFilter, setDoctorFilter] = useState('all')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  useEffect(() => { if (globalSearch) setSearch(globalSearch) }, [globalSearch])
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [layout, setLayout] = useState<'cards' | 'table'>('cards')
  const [showUpload, setShowUpload] = useState(false)
  const [editing, setEditing] = useState<MedicalRecord | null>(null)
  const [preview, setPreview] = useState<MedicalRecord | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)
  if (!currentUser) return null
  const all = db.records.filter(r => r.patientId === currentUser.id)
  const providers = Array.from(new Set(all.map(r => r.provider))).sort()
  const doctors = db.doctors.map(d => db.profiles.find(p => p.id === d.profileId)?.name).filter((name): name is string => Boolean(name && all.some(r => r.provider.toLowerCase().includes(name.toLowerCase()))))
  const filtered = all.filter(r => {
    const haystack = `${r.title} ${r.provider} ${r.notes || ''} ${r.tags.join(' ')}`.toLowerCase()
    return (!search || haystack.includes(search.toLowerCase())) && (category === 'all' || r.category === category) && (provider === 'all' || r.provider === provider) && (doctorFilter === 'all' || r.provider.toLowerCase().includes(doctorFilter.toLowerCase())) && (!dateFrom || r.date >= dateFrom) && (!dateTo || r.date <= dateTo)
  }).sort((a, b) => sort === 'newest' ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date))
  const saveRecord = async (data: Omit<MedicalRecord, 'id' | 'patientId' | 'uploadedAt' | 'uploadedBy'>, existingId?: string) => {
    if (loading) return
    setLoading(true)
    try {
      const retainedBytes = all.filter(r => r.id !== existingId).reduce((sum, r) => sum + (r.fileData?.length || 0) * .75, 0)
      const incomingBytes = (data.fileData?.length || 0) * .75
      if (retainedBytes + incomingBytes > 3.5 * 1024 * 1024) throw new Error('Demo file storage limit reached. Remove older attachments or choose a smaller file.')
      const record: MedicalRecord = { ...data, id: existingId || uid('record'), patientId: currentUser.id, uploadedAt: existingId ? (all.find(r => r.id === existingId)?.uploadedAt || new Date().toISOString()) : new Date().toISOString(), uploadedBy: existingId ? (all.find(r => r.id === existingId)?.uploadedBy || currentUser.id) : currentUser.id }
      mutate(prev => ({ ...prev, records: existingId ? prev.records.map(r => r.id === existingId ? record : r) : [record, ...prev.records] }))
      if (!existingId) addAudit('record_upload', `Uploaded record: ${record.title}.`, currentUser.id)
      toast(existingId ? 'Record details updated.' : 'Record uploaded to your demo vault.')
      setShowUpload(false); setEditing(null)
    } catch (error) { toast(error instanceof Error ? error.message : 'Could not save this record. Try a smaller file.', 'error') }
    finally { setLoading(false) }
  }
  const removeRecord = (record: MedicalRecord) => {
    if (!window.confirm(`Delete “${record.title}” from your demo vault? This cannot be undone.`)) return
    mutate(prev => ({ ...prev, records: prev.records.filter(r => r.id !== record.id) }))
    addAudit('record_delete', `Deleted record: ${record.title}.`, currentUser.id)
    toast('Record deleted from this browser.')
    setActiveMenu(null)
  }
  const setGlobal = (value: string) => { setSearch(value); if (globalSearch && clearGlobalSearch) clearGlobalSearch() }
  const openRecord = (record: MedicalRecord) => { setPreview(record); addAudit('record_view', `Viewed record: ${record.title}.`, currentUser.id) }
  return <div className="page-stack">
    <PageTitle eyebrow="YOUR PERSONAL VAULT" title="Medical records" description="A searchable home for the health documents you choose to keep." action={<Button onClick={() => setShowUpload(true)}><Upload size={16} /> Upload record</Button>} />
    <div className="vault-summary-strip"><span className="summary-vault-icon"><LockKeyhole size={17} /></span><div><b>{all.length} records in your vault</b><small>Stored in this browser demo · never enter real medical information</small></div><Badge tone="teal">Private demo vault</Badge></div>
    <section className="panel records-panel">
      <div className="record-toolbar"><div className="record-search"><Search size={16} /><input value={search} onChange={e => setGlobal(e.target.value)} placeholder="Search title, provider or tag…" />{search && <button aria-label="Clear search" onClick={() => setGlobal('')}><X size={14} /></button>}</div><div className="record-filters"><label><ListFilter size={15} /><select value={category} onChange={e => setCategory(e.target.value)}><option value="all">All categories</option>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label><Stethoscope size={15} /><select value={provider} onChange={e => setProvider(e.target.value)}><option value="all">All providers</option>{providers.map(p => <option key={p}>{p}</option>)}</select></label><label><UserRound size={14} /><select value={doctorFilter} onChange={e => setDoctorFilter(e.target.value)}><option value="all">All doctors</option>{doctors.map(name => <option key={name}>{name}</option>)}</select></label><label className="date-filter"><span>From</span><input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} /></label><label className="date-filter"><span>To</span><input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} /></label><label className="sort-select"><select value={sort} onChange={e => setSort(e.target.value as 'newest' | 'oldest')}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select><ChevronDown size={13} /></label><div className="view-switch"><button className={layout === 'cards' ? 'active' : ''} onClick={() => setLayout('cards')} aria-label="Card view"><i className="grid-view-icon" /></button><button className={layout === 'table' ? 'active' : ''} onClick={() => setLayout('table')} aria-label="Table view"><i className="list-view-icon" /></button></div></div></div>
      <div className="results-count">Showing <b>{filtered.length}</b> of {all.length} records {search || category !== 'all' || provider !== 'all' || doctorFilter !== 'all' || dateFrom || dateTo ? '· Filters applied' : ''}</div>
      {filtered.length ? layout === 'cards' ? <div className="record-card-grid">{filtered.map(record => <RecordCard key={record.id} record={record} all={all} onPreview={() => openRecord(record)} onEdit={() => setEditing(record)} onDelete={() => removeRecord(record)} activeMenu={activeMenu} setActiveMenu={setActiveMenu} />)}</div> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Record</th><th>Category</th><th>Provider</th><th>Date</th><th>Flags</th><th></th></tr></thead><tbody>{filtered.map(record => <tr key={record.id}><td><button className="table-record-name" onClick={() => openRecord(record)}><span className={`record-type-icon type-${record.category}`}><FileText size={15} /></span><span><b>{record.title}</b><small>{record.fileName || 'Structured demo record'}</small></span></button></td><td>{CATEGORY_LABELS[record.category]}</td><td>{record.provider}</td><td>{fmtDate(record.date)}</td><td>{isDuplicateRecord(record, all) && <Badge tone="amber">Possible duplicate</Badge>}</td><td><button className="icon-button" onClick={() => openRecord(record)} aria-label="Open record"><ChevronRight size={16} /></button></td></tr>)}</tbody></table></div> : <EmptyState icon={<FileHeart size={25} />} title={all.length ? 'No matching records' : 'Your vault is ready'} description={all.length ? 'Try another search term or clear one of the filters.' : 'Upload a report, prescription or other document to start your personal timeline.'} action={!all.length && <Button onClick={() => setShowUpload(true)}><Upload size={15} /> Upload your first record</Button>} />}
    </section>
    <div className="fictional-notice"><Info size={14} /><span>Supported formats: PDF, JPG and PNG. Files are saved locally in this browser for the demo; this is not private cloud storage.</span></div>
    <RecordForm open={showUpload || !!editing} initial={editing} loading={loading} onClose={() => { setShowUpload(false); setEditing(null) }} onSave={data => saveRecord(data, editing?.id)} />
    <RecordPreview open={!!preview} record={preview} onClose={() => setPreview(null)} onDownload={record => { downloadRecord(record); addAudit('record_download', `Downloaded record: ${record.title}.`, currentUser.id); toast('Download prepared.') }} />
  </div>
}

function RecordCard({ record, all, onPreview, onEdit, onDelete, activeMenu, setActiveMenu }: { record: MedicalRecord; all: MedicalRecord[]; onPreview: () => void; onEdit: () => void; onDelete: () => void; activeMenu: string | null; setActiveMenu: (id: string | null) => void }) {
  const duplicate = isDuplicateRecord(record, all)
  return <article className="record-card"><button className="record-card-open" onClick={onPreview}><div className="record-card-top"><span className={`record-type-icon type-${record.category}`}><FileText size={18} /></span><span className="record-date-mini">{fmtDate(record.date)}</span></div><h3>{record.title}</h3><span className="record-category-label">{CATEGORY_LABELS[record.category]}</span><p className="record-provider"><Stethoscope size={13} /> {record.provider}</p>{record.labResults?.length ? <div className="lab-result-snippet">{record.labResults.slice(0, 2).map((lab, i) => <span key={i}><small>{lab.test}</small><b>{lab.value} <em>{lab.unit}</em></b></span>)}</div> : <p className="record-notes-preview">{record.notes || 'No notes added.'}</p>}<div className="record-card-footer"><span>{record.tags.slice(0, 2).map(tag => <i key={tag}>#{tag}</i>)}</span><span className="open-record-link">Open <ArrowRight size={13} /></span></div></button><div className="record-card-menu-wrap"><button className="icon-button record-more" aria-label="Record options" onClick={() => setActiveMenu(activeMenu === record.id ? null : record.id)}><MoreHorizontal size={17} /></button>{activeMenu === record.id && <div className="mini-menu"><button onClick={() => { onEdit(); setActiveMenu(null) }}><Pencil size={14} /> Edit details</button><button className="danger-menu" onClick={onDelete}><Trash2 size={14} /> Delete record</button></div>}</div>{duplicate && <div className="duplicate-flag"><AlertCircle size={12} /> Possible duplicate · review</div>}</article>
}

function RecordForm({ open, initial, loading, onClose, onSave }: { open: boolean; initial: MedicalRecord | null; loading: boolean; onClose: () => void; onSave: (record: Omit<MedicalRecord, 'id' | 'patientId' | 'uploadedAt' | 'uploadedBy'>) => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(dateOnly(new Date()))
  const [category, setCategory] = useState<RecordCategory>('blood_test')
  const [provider, setProvider] = useState('')
  const [notes, setNotes] = useState('')
  const [tags, setTags] = useState('')
  const [fileName, setFileName] = useState('')
  const [fileType, setFileType] = useState('')
  const [fileData, setFileData] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useMemo(() => {
    setTitle(initial?.title || ''); setDate(initial?.date || dateOnly(new Date())); setCategory(initial?.category || 'blood_test'); setProvider(initial?.provider || ''); setNotes(initial?.notes || ''); setTags(initial?.tags.join(', ') || ''); setFileName(initial?.fileName || ''); setFileType(initial?.fileType || ''); setFileData(initial?.fileData); setError('')
  }, [initial, open])
  if (!open) return null
  const fileChange = async (file?: File) => {
    if (!file) return
    const ext = fileExt(file.name)
    if (!['pdf', 'jpg', 'jpeg', 'png'].includes(ext)) return setError('Choose a PDF, JPG or PNG file.')
    if (file.size > 3 * 1024 * 1024) return setError('For browser demo storage, choose a file smaller than 3 MB.')
    setError(''); setBusy(true)
    try { setFileData(await readFileAsDataURL(file)); setFileName(file.name); setFileType(file.type || (ext === 'pdf' ? 'application/pdf' : `image/${ext === 'jpg' ? 'jpeg' : ext}`)) }
    catch { setError('Could not read that file. Try again.') }
    finally { setBusy(false) }
  }
  const submit = (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!title.trim() || !provider.trim() || !date) return setError('Add a title, date and provider before saving.')
    onSave({ title: title.trim(), date, category, provider: provider.trim(), notes: notes.trim(), tags: tags.split(',').map(s => s.trim()).filter(Boolean), fileName: fileName || undefined, fileType: fileType || undefined, fileData, labResults: initial?.labResults, bloodPressure: initial?.bloodPressure })
  }
  return <Modal open={open} title={initial ? 'Edit record details' : 'Add a medical record'} eyebrow={initial ? 'RECORD METADATA' : 'PERSONAL VAULT'} onClose={onClose} wide>
    <form className="modal-form" onSubmit={submit}><div className="form-grid"><Field label="Record title" required><input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Complete blood count" autoFocus /></Field><Field label="Category" required><select value={category} onChange={e => setCategory(e.target.value as RecordCategory)}>{categories.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><Field label="Report or visit date" required><input type="date" value={date} onChange={e => setDate(e.target.value)} max={dateOnly(new Date())} /></Field><Field label="Provider / clinic" required><input value={provider} onChange={e => setProvider(e.target.value)} placeholder="Lab, doctor or hospital" /></Field></div><Field label="Notes" hint="Optional context you want to remember."><textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Add a short note…" rows={3} /></Field><Field label="Tags" hint="Separate tags with commas."><input value={tags} onChange={e => setTags(e.target.value)} placeholder="e.g. annual check-up, follow-up" /></Field><div className="upload-dropzone"><input id="record-file" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" onChange={e => fileChange(e.target.files?.[0])} /><label htmlFor="record-file"><span className="upload-drop-icon"><Upload size={19} /></span><span><b>{fileName || 'Choose a report to attach'}</b><small>{fileName ? 'Click to replace · PDF, JPG or PNG' : 'PDF, JPG or PNG · maximum 3 MB in demo mode'}</small></span><Button variant="outline" size="sm" type="button" onClick={e => { e.preventDefault(); document.getElementById('record-file')?.click() }}>Browse files</Button></label></div>{error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}<div className="modal-foot"><span className="local-storage-note"><LockKeyhole size={13} /> Saved only in this browser demo</span><div><Button variant="outline" onClick={onClose}>Cancel</Button><Button type="submit" disabled={busy || loading}>{loading ? 'Saving…' : initial ? 'Save changes' : 'Add to vault'}</Button></div></div></form>
  </Modal>
}

export function RecordPreview({ open, record, onClose, onDownload }: { open: boolean; record: MedicalRecord | null; onClose: () => void; onDownload: (record: MedicalRecord) => void }) {
  if (!record) return null
  const isImage = record.fileType?.startsWith('image/')
  const isPdf = record.fileType === 'application/pdf' || record.fileName?.toLowerCase().endsWith('.pdf')
  return <Modal open={open} title={record.title} eyebrow={CATEGORY_LABELS[record.category].toUpperCase()} onClose={onClose} wide><div className="record-preview-meta"><span><CalendarDays size={14} /> {fmtDate(record.date)}</span><span><Stethoscope size={14} /> {record.provider}</span>{record.fileName && <span><FileText size={14} /> {record.fileName}</span>}</div><div className="document-viewer">{record.fileData && isImage ? <img className="document-image" src={record.fileData} alt={record.title} /> : record.fileData && isPdf ? <iframe className="document-frame" title={record.title} src={record.fileData} /> : <div className="sample-document"><div className="sample-doc-head"><div className="brand-mark small"><HeartPulse size={14} /></div><span>MEDIVAULT · FICTIONAL SAMPLE DOCUMENT</span></div><div className="sample-doc-body"><div className="sample-doc-provider">{record.provider}</div><h2>{record.title}</h2><div className="sample-doc-date">Report date · {fmtDate(record.date)}</div>{record.notes && <p>{record.notes}</p>}{record.labResults?.map((lab, i) => <div className="sample-lab-row" key={i}><span><b>{lab.test}</b><small>Reference: {lab.referenceRange || 'Not supplied'}</small></span><strong>{lab.value} <small>{lab.unit}</small></strong></div>)}{record.bloodPressure && <div className="sample-lab-row"><span><b>Blood pressure</b><small>Recorded as supplied</small></span><strong>{record.bloodPressure.systolic}/{record.bloodPressure.diastolic} <small>mmHg</small></strong></div>}<div className="sample-demo-stamp">DEMO DATA · NOT FOR CLINICAL USE</div></div></div>}</div><div className="document-foot"><span><Info size={14} /> {record.fileData ? 'Local preview only. The file is stored in this browser.' : 'Sample preview assembled from fictional structured demo data.'}</span><Button variant="outline" size="sm" onClick={() => onDownload(record)}><ArrowDownToLine size={15} /> Download</Button></div></Modal>
}

export function downloadRecord(record: MedicalRecord) {
  const a = document.createElement('a')
  if (record.fileData) { a.href = record.fileData; a.download = record.fileName || `${record.title.replace(/[^a-z0-9]+/gi, '-')}.${record.fileType?.includes('pdf') ? 'pdf' : 'png'}` }
  else {
    const text = `MediVault fictional demo record\n\nTitle: ${record.title}\nCategory: ${CATEGORY_LABELS[record.category]}\nDate: ${record.date}\nProvider: ${record.provider}\nNotes: ${record.notes || 'None'}\n\n${record.labResults?.map(l => `${l.test}: ${l.value} ${l.unit} | reference: ${l.referenceRange || 'not supplied'}`).join('\n') || ''}\n\nThis file is fictional demo data, not medical advice.`
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); a.download = `${record.title.replace(/[^a-z0-9]+/gi, '-')}.txt`
  }
  a.click()
  if (a.href.startsWith('blob:')) URL.revokeObjectURL(a.href)
}

interface TimelineEvent { id: string; date: string; title: string; provider: string; detail: string; type: string; record?: MedicalRecord; source: string }
export function PatientTimelinePage() {
  const { db, currentUser, addAudit } = useStore()
  const [type, setType] = useState('all')
  const [range, setRange] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [selected, setSelected] = useState<MedicalRecord | null>(null)
  if (!currentUser) return null
  const records = db.records.filter(r => r.patientId === currentUser.id)
  const events: TimelineEvent[] = [
    ...records.map(r => ({ id: r.id, date: r.date, title: r.title, provider: r.provider, detail: r.notes || r.labResults?.map(l => `${l.test}: ${l.value} ${l.unit}`).join(' · ') || CATEGORY_LABELS[r.category], type: r.category, record: r, source: 'Medical record' })),
    ...db.conditions.filter(c => c.patientId === currentUser.id).map(c => ({ id: c.id, date: c.diagnosedDate || '', title: c.condition, provider: c.recordedBy, detail: c.confirmed ? 'Clinician-confirmed condition' : 'Patient-reported information', type: 'diagnosis', source: 'Health profile' })),
    ...db.diagnoses.filter(d => d.patientId === currentUser.id).map(d => ({ id: d.id, date: d.date, title: `Diagnosis recorded: ${d.condition}`, provider: d.doctorId ? getProfileName(db, d.doctorId) : 'Clinician entry', detail: d.notes || 'Clinician-authored diagnosis entry', type: 'diagnosis', source: d.confirmed ? 'Clinician-confirmed' : 'Needs verification' })),
    ...db.allergies.filter(a => a.patientId === currentUser.id).map(a => ({ id: a.id, date: a.dateRecorded, title: `Allergy recorded: ${a.allergen}`, provider: a.recordedBy, detail: a.reaction || 'Reaction not recorded', type: 'allergy', source: a.confirmed ? 'Clinician-confirmed' : 'Patient-reported' })),
    ...db.medications.filter(m => m.patientId === currentUser.id).map(m => ({ id: m.id, date: m.startDate, title: `${m.status === 'active' ? 'Medication added' : 'Medication history'}: ${m.name}`, provider: m.prescribingDoctor || 'Patient list', detail: `${m.dose || 'Dose not recorded'} · ${m.status}`, type: 'medication', source: 'Medication list' })),
    ...db.notes.filter(n => n.patientId === currentUser.id).map(n => ({ id: n.id, date: n.visitDate, title: 'Consultation note', provider: getProfileName(db, n.doctorId), detail: n.chiefComplaint, type: 'consultation', source: 'Clinician note' })),
  ].filter(event => event.date).sort((a, b) => b.date.localeCompare(a.date))
  const visible = events.filter(e => (type === 'all' || e.type === type) && (range === 'all' || (range === 'custom' ? (!from || e.date >= from) && (!to || e.date <= to) : new Date(e.date) >= new Date(Date.now() - Number(range) * 86400000))) )
  const types = Array.from(new Set(events.map(e => e.type)))
  return <div className="page-stack"><PageTitle eyebrow="A CHRONOLOGICAL VIEW" title="Medical timeline" description="Visits, test reports and health updates in date order." action={<Badge tone="teal"><Activity size={13} /> {events.length} events</Badge>} /><section className="panel timeline-filter-panel"><div className="filter-label"><Filter size={15} /> Filter your timeline</div><div className="timeline-filters"><label><span>Event type</span><select value={type} onChange={e => setType(e.target.value)}><option value="all">All event types</option>{types.map(t => <option value={t} key={t}>{t.replace('_', ' ').replace(/\w/g, c => c.toUpperCase())}</option>)}</select></label><label><span>Date range</span><select value={range} onChange={e => setRange(e.target.value)}><option value="all">All time</option><option value="90">Last 90 days</option><option value="180">Last 6 months</option><option value="365">Last 12 months</option><option value="custom">Custom dates</option></select></label>{range === 'custom' && <><label><span>From</span><input type="date" value={from} onChange={e => setFrom(e.target.value)} /></label><label><span>To</span><input type="date" value={to} onChange={e => setTo(e.target.value)} /></label></>}</div></section><div className="timeline-container"><div className="timeline-year-label">YOUR HEALTH HISTORY <span>{visible.length} EVENTS</span></div>{visible.length ? <div className="timeline-list">{visible.map((event, index) => <div className="timeline-row" key={`${event.type}-${event.id}`}><div className="timeline-date">{fmtDate(event.date)}<small>{new Date(event.date).toLocaleDateString('en-IN', { weekday: 'short' })}</small></div><div className={`timeline-marker marker-${event.type}`}><i /></div><div className="timeline-event-card"><div className="timeline-card-heading"><span className="timeline-kind">{event.source}</span><span className="timeline-category">{event.type.replace('_', ' ')}</span></div><h3>{event.record ? <button onClick={() => { setSelected(event.record!); addAudit('record_view', `Viewed record: ${event.record!.title}.`, currentUser.id) }}>{event.title} <ArrowUpRight size={14} /></button> : event.title}</h3><p>{event.detail}</p><div className="timeline-provider"><Stethoscope size={13} /> {event.provider}</div>{event.record?.labResults && <div className="timeline-lab-values">{event.record.labResults.map((lab, i) => { const previous = records.filter(r => r.date < event.record!.date && r.labResults?.some(prev => normalize(prev.test) === normalize(lab.test))).sort((a,b)=>b.date.localeCompare(a.date))[0]; const previousResult = previous?.labResults?.find(prev => normalize(prev.test) === normalize(lab.test)); return <span key={i}><b>{lab.test}</b> {lab.value} {lab.unit}{previousResult && <small className="timeline-previous-value">Previous {previousResult.value} {previousResult.unit} · {fmtDate(previous!.date)}</small>}</span> })}</div>}</div></div>)}</div> : <EmptyState icon={<Activity size={25} />} title="No events in this view" description="Adjust the date range or category to see more of your history." />}</div><div className="fictional-notice"><Info size={14} /> Timeline events are organized from the records and information entered in this demo.</div><RecordPreview open={!!selected} record={selected} onClose={() => setSelected(null)} onDownload={record => { downloadRecord(record); addAudit('record_download', `Downloaded record: ${record.title}.`, currentUser.id) }} /></div>
}

export function PatientMedicationsPage() {
  const { db, currentUser, mutate, addAudit } = useStore()
  const toast = useToast()
  const [addOpen, setAddOpen] = useState(false)
  const [showInstructions, setShowInstructions] = useState(false)
  const [form, setForm] = useState({ name: '', dose: '', frequency: '', startDate: dateOnly(new Date()), endDate: '', doctor: '', instructions: '' })
  const [error, setError] = useState('')
  if (!currentUser) return null
  const meds = db.medications.filter(m => m.patientId === currentUser.id)
  const active = meds.filter(m => m.status === 'active')
  const historical = meds.filter(m => m.status === 'discontinued')
  const duplicate = form.name.trim() && active.some(m => normalize(m.name) === normalize(form.name))
  const add = (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!form.name.trim() || !form.startDate) return setError('Enter a medicine name and start date.')
    const medication: Medication = { id: uid('med'), patientId: currentUser.id, name: form.name.trim(), dose: form.dose.trim() || undefined, frequency: form.frequency.trim() || undefined, startDate: form.startDate, endDate: form.endDate || undefined, prescribingDoctor: form.doctor.trim() || undefined, status: form.endDate && form.endDate < dateOnly(new Date()) ? 'discontinued' : 'active', instructions: form.instructions.trim() || undefined, addedBy: currentUser.id }
    mutate(prev => ({ ...prev, medications: [medication, ...prev.medications] }))
    addAudit('record_upload', `Added medication list entry: ${medication.name}.`, currentUser.id)
    toast('Medication added to your demo list.')
    setAddOpen(false); setForm({ name: '', dose: '', frequency: '', startDate: dateOnly(new Date()), endDate: '', doctor: '', instructions: '' })
  }
  const updateStatus = (med: Medication, status: Medication['status']) => {
    mutate(prev => ({ ...prev, medications: prev.medications.map(m => m.id === med.id ? { ...m, status, endDate: status === 'discontinued' ? dateOnly(new Date()) : undefined } : m) }))
    toast(status === 'discontinued' ? `${med.name} marked discontinued in your list.` : `${med.name} marked active.`)
  }
  const markIntake = (med: Medication, status: 'taken' | 'missed') => {
    mutate(prev => ({ ...prev, intake: [{ medicationId: med.id, date: dateOnly(new Date()), status }, ...prev.intake.filter(i => !(i.medicationId === med.id && i.date === dateOnly(new Date()))) ] }))
    toast(`${med.name} marked ${status} today.`)
  }
  const intakeFor = (id: string) => db.intake.find(i => i.medicationId === id && i.date === dateOnly(new Date()))
  const renderMed = (med: Medication, current: boolean) => <article className="medication-card" key={med.id}><div className="med-card-top"><span className={`med-icon ${current ? '' : 'med-icon-muted'}`}><HeartPulse size={19} /></span><Badge tone={current ? 'green' : 'neutral'}>{current ? 'Active' : 'Discontinued'}</Badge><button className="med-action-dots" title="Options" onClick={() => updateStatus(med, current ? 'discontinued' : 'active')}><MoreHorizontal size={18} /></button></div><h3>{med.name}</h3><p className="med-dose">{med.dose || <i>Dose not recorded</i>} <span>·</span> {med.frequency || 'Frequency not recorded'}</p><div className="med-details"><span><small>STARTED</small>{fmtDate(med.startDate)}</span><span><small>PRESCRIBED BY</small>{med.prescribingDoctor || 'Not recorded'}</span></div>{med.instructions && <div className="med-instructions"><Info size={13} /> {med.instructions}</div>}{current && <div className="tracker-row"><span>{intakeFor(med.id) ? <><CheckCircle2 size={14} /> Marked {intakeFor(med.id)?.status} today</> : 'Demo tracker · today'}</span><div><button className={intakeFor(med.id)?.status === 'taken' ? 'tracked' : ''} onClick={() => markIntake(med, 'taken')}>Taken</button><button className={intakeFor(med.id)?.status === 'missed' ? 'tracked' : ''} onClick={() => markIntake(med, 'missed')}>Missed</button></div></div>}</article>
  return <div className="page-stack"><PageTitle eyebrow="MEDICATION MANAGER" title="Medications" description="Keep your current and past medication list together. Verify entries with your clinician." action={<Button onClick={() => setAddOpen(true)}><Plus size={16} /> Add medication</Button>} /><div className="medication-notice"><ShieldAlert size={18} /><span><b>Medication list ≠ medical advice.</b> Tracking here does not replace your doctor’s or pharmacist’s instructions. This demo does not check for interactions.</span></div><section className="med-section"><div className="section-line-heading"><div><h2>Current medications</h2><span>{active.length} active {active.length === 1 ? 'entry' : 'entries'}</span></div><Badge tone="green"><i className="status-dot" /> Current list</Badge></div>{active.length ? <div className="medication-grid">{active.map(m => renderMed(m, true))}</div> : <div className="panel"><EmptyState icon={<HeartPulse size={24} />} title="No active medications recorded" description="Add an entry if you want to keep your list here. Confirm every medicine with a clinician." action={<Button onClick={() => setAddOpen(true)}><Plus size={15} /> Add medication</Button>} /></div>}</section><section className="med-section"><div className="section-line-heading"><div><h2>Medication history</h2><span>Discontinued or historical entries</span></div></div>{historical.length ? <div className="medication-grid">{historical.map(m => renderMed(m, false))}</div> : <div className="quiet-empty">No discontinued medication entries yet.</div>}</section><div className="fictional-notice"><Info size={14} /> Medication entries and tracking are simulated and saved locally in this browser only.</div>
    <Modal open={addOpen} title="Add a medication" eyebrow="MEDICATION LIST" onClose={() => setAddOpen(false)}><form className="modal-form" onSubmit={add}><Field label="Medicine name" required><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Name as written on the package" autoFocus /></Field>{duplicate && <div className="duplicate-med-warning"><AlertCircle size={15} /><span><b>Possible duplicate entry</b><small>A medication with a similar name is already in your current list. Check with your clinician before adding duplicates.</small></span></div>}<div className="form-grid"><Field label="Dose"><input value={form.dose} onChange={e => setForm({ ...form, dose: e.target.value })} placeholder="e.g. 250 mg" /></Field><Field label="Frequency"><input value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} placeholder="As prescribed" /></Field><Field label="Start date" required><input type="date" value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })} /></Field><Field label="End date (optional)"><input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} /></Field></div><Field label="Prescribing doctor"><input value={form.doctor} onChange={e => setForm({ ...form, doctor: e.target.value })} placeholder="Name, if known" /></Field><Field label="Instructions (optional)"><textarea rows={2} value={form.instructions} onChange={e => setForm({ ...form, instructions: e.target.value })} placeholder="Record only what your clinician provided." /></Field>{error && <div className="form-error">{error}</div>}<div className="modal-foot"><span className="local-storage-note">Fictional demo list</span><div><Button variant="outline" onClick={() => setAddOpen(false)}>Cancel</Button><Button type="submit">Save medication</Button></div></div></form></Modal>
  </div>
}

export function PatientHealthPage() {
  const { db, currentUser, mutate, addAudit } = useStore()
  const toast = useToast()
  const [edit, setEdit] = useState(false)
  const [addAllergy, setAddAllergy] = useState(false)
  const [allergyForm, setAllergyForm] = useState({ allergen: '', reaction: '', severity: 'moderate' as Allergy['severity'] })
  const [conditionForm, setConditionForm] = useState('')
  const [error, setError] = useState('')
  if (!currentUser) return null
  const patient = db.patients.find(p => p.profileId === currentUser.id)
  const allergies = db.allergies.filter(a => a.patientId === currentUser.id)
  const conditions = db.conditions.filter(c => c.patientId === currentUser.id)
  const meds = db.medications.filter(m => m.patientId === currentUser.id && m.status === 'active')
  const surgeries = db.surgeries.filter(s => s.patientId === currentUser.id)
  const records = db.records.filter(r => r.patientId === currentUser.id).sort((a, b) => b.date.localeCompare(a.date))
  const savePatient = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    mutate(prev => ({ ...prev, patients: prev.patients.map(p => p.profileId === currentUser.id ? { ...p, bloodGroup: String(form.get('bloodGroup') || ''), emergencyContactName: String(form.get('contactName') || ''), emergencyContactPhone: String(form.get('contactPhone') || ''), emergencyContactRelation: String(form.get('contactRelation') || '') } : p) }))
    toast('Health profile updated in this browser.'); setEdit(false)
  }
  const addNewAllergy = (event: React.FormEvent) => {
    event.preventDefault(); setError('')
    if (!allergyForm.allergen.trim()) return setError('Enter an allergy or allergen name.')
    const item: Allergy = { id: uid('allergy'), patientId: currentUser.id, allergen: allergyForm.allergen.trim(), reaction: allergyForm.reaction.trim() || undefined, severity: allergyForm.severity, confirmed: false, recordedBy: 'Patient-reported', dateRecorded: dateOnly(new Date()) }
    mutate(prev => ({ ...prev, allergies: [item, ...prev.allergies] }))
    addAudit('record_upload', `Added patient-reported allergy entry: ${item.allergen}.`, currentUser.id)
    toast('Allergy added as patient-reported information.'); setAllergyForm({ allergen: '', reaction: '', severity: 'moderate' }); setAddAllergy(false)
  }
  const addCondition = () => {
    if (!conditionForm.trim()) return
    mutate(prev => ({ ...prev, conditions: [{ id: uid('condition'), patientId: currentUser.id, condition: conditionForm.trim(), confirmed: false, recordedBy: 'Patient-reported', diagnosedDate: dateOnly(new Date()) }, ...prev.conditions] }))
    addAudit('record_upload', 'Added patient-reported health information.', currentUser.id)
    toast('Condition added as patient-reported information.'); setConditionForm('')
  }
  const exportSummary = () => {
    if (!printableSummary(currentUser.name, patient?.patientId || '—', { allergies, meds, conditions, records, surgeries, emergencyContact: patient?.emergencyContactName ? `${patient.emergencyContactName} · ${patient.emergencyContactRelation || 'relationship not recorded'} · ${patient.emergencyContactPhone || 'phone not recorded'}` : '' })) toast('Pop-up blocked. Allow pop-ups to print a summary.', 'error')
    else addAudit('summary_generated', 'Generated a patient health summary for printing.', currentUser.id)
  }
  return <div className="page-stack"><PageTitle eyebrow="YOUR HEALTH PROFILE" title="Health summary" description="A concise view to carry into a new visit. Patient-reported information is labeled separately." action={<Button variant="outline" onClick={exportSummary}><ArrowDownToLine size={16} /> Print / save summary</Button>} /><div className="health-summary-banner"><div className="summary-avatar">{initials(currentUser.name)}</div><div><h2>{currentUser.name}</h2><span><UserRound size={14} /> Patient ID · {patient?.patientId} <i /> DOB · {fmtDate(patient?.dob)} <i /> {patient?.gender || 'Gender not recorded'}</span></div><Badge tone="teal"><ShieldCheck size={13} /> Your profile</Badge><button className="icon-button" onClick={() => setEdit(!edit)} aria-label="Edit emergency contact and health details"><Pencil size={16} /></button></div>
    {edit && <form className="panel edit-profile-form" onSubmit={savePatient}><div className="form-grid"><Field label="Blood group"><select name="bloodGroup" defaultValue={patient?.bloodGroup || ''}><option value="">Not recorded</option><option>A+</option><option>A−</option><option>B+</option><option>B−</option><option>AB+</option><option>AB−</option><option>O+</option><option>O−</option></select></Field><Field label="Emergency contact name"><input name="contactName" defaultValue={patient?.emergencyContactName || ''} /></Field><Field label="Contact phone"><input name="contactPhone" defaultValue={patient?.emergencyContactPhone || ''} /></Field><Field label="Relationship"><input name="contactRelation" defaultValue={patient?.emergencyContactRelation || ''} /></Field></div><div className="edit-actions"><Button variant="outline" onClick={() => setEdit(false)}>Cancel</Button><Button type="submit">Save profile</Button></div></form>}
    <div className="health-info-grid"><section className="panel health-info-card"><div className="health-card-heading"><div className="health-info-icon allergy-info-icon"><AlertCircle size={18} /></div><div><h3>Allergies</h3><small>Known entries and reported reactions</small></div><button className="icon-button" onClick={() => setAddAllergy(true)} aria-label="Add allergy"><Plus size={17} /></button></div>{allergies.length ? <div className="health-list">{allergies.map(a => <div className="allergy-item" key={a.id}><div><b>{a.allergen}</b><small>{a.reaction || 'Reaction not recorded'}</small></div><div className="allergy-badges"><Badge tone={a.severity === 'severe' ? 'red' : a.severity === 'moderate' ? 'amber' : 'neutral'}>{a.severity || 'severity unknown'}</Badge><span className="reported-tag">{a.confirmed ? 'Clinician-confirmed' : 'Patient-reported'}</span></div></div>)}</div> : <div className="inline-empty"><Info size={16} /><span><b>No known allergies recorded</b><small>This is not the same as a verified “no allergies” status.</small></span></div>}</section>
      <section className="panel health-info-card"><div className="health-card-heading"><div className="health-info-icon condition-info-icon"><HeartPulse size={18} /></div><div><h3>Chronic conditions</h3><small>Confirmed and patient-reported health information</small></div></div>{conditions.length ? <div className="health-list">{conditions.map(c => <div className="condition-item" key={c.id}><div className="condition-bullet" /><div><b>{c.condition}</b><small>{c.confirmed ? `Clinician-confirmed · ${c.recordedBy}` : 'Patient-reported · needs clinician verification'}</small>{c.diagnosedDate && <small>Recorded {fmtDate(c.diagnosedDate)}</small>}</div><Badge tone={c.confirmed ? 'blue' : 'amber'}>{c.confirmed ? 'Confirmed' : 'Reported'}</Badge></div>)}</div> : <div className="inline-empty"><Info size={16} /><span><b>No conditions recorded</b><small>Use Add to include patient-reported information.</small></span></div>}<div className="inline-add-row"><input value={conditionForm} onChange={e => setConditionForm(e.target.value)} placeholder="Add patient-reported condition…" /><button onClick={addCondition} disabled={!conditionForm.trim()}><Plus size={15} /> Add</button></div></section>
      <section className="panel health-info-card"><div className="health-card-heading"><div className="health-info-icon medication-info-icon"><HeartPulse size={18} /></div><div><h3>Current medications</h3><small>{meds.length} active entries in your list</small></div><button className="text-action" onClick={() => window.dispatchEvent(new CustomEvent('medivault:navigate', { detail: 'medications' }))}>Manage <ArrowRight size={14} /></button></div>{meds.length ? <div className="health-list">{meds.map(m => <div className="health-med-item" key={m.id}><span className="mini-med-icon"><HeartPulse size={14} /></span><span><b>{m.name}</b><small>{m.dose || 'Dose not recorded'} · {m.frequency || 'Frequency not recorded'}</small></span><Badge tone="green">Active</Badge></div>)}</div> : <div className="inline-empty"><Info size={16} /><span><b>No active medications</b><small>Add an entry to keep your list up to date.</small></span></div>}</section>
      <section className="panel health-info-card"><div className="health-card-heading"><div className="health-info-icon surgery-info-icon"><FileCheck2 size={18} /></div><div><h3>Previous procedures</h3><small>Imported from your records</small></div></div>{surgeries.length ? <div className="health-list">{surgeries.map(s => <div className="condition-item" key={s.id}><div><b>{s.procedure}</b><small>{fmtDate(s.date)} · {s.hospital || 'Provider not recorded'}</small></div></div>)}</div> : <div className="inline-empty"><Info size={16} /><span><b>No procedures recorded</b><small>Add details to an attached record if relevant.</small></span></div>}</section></div>
    <section className="panel emergency-contact-panel"><div className="contact-icon"><UsersRound size={19} /></div><div><div className="eyebrow">EMERGENCY CONTACT</div>{patient?.emergencyContactName ? <><h3>{patient.emergencyContactName}</h3><p>{patient.emergencyContactRelation || 'Relationship not recorded'} · {patient.emergencyContactPhone || 'Phone not recorded'}</p></> : <><h3>Not recorded yet</h3><p>Add a contact who may be reached in an emergency.</p></>}</div><Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil size={14} /> Edit details</Button></section>
    <div className="health-source-note"><div><Badge tone="blue">Clinician-confirmed</Badge><span>Information attributed to a clinician or source record.</span></div><div><Badge tone="amber">Patient-reported</Badge><span>Information you entered; verify with a clinician.</span></div></div>
    <div className="fictional-notice"><Info size={14} /> A portable health summary is generated from records in this local demo. Verify all facts and dates before use.</div>
    <Modal open={addAllergy} title="Add an allergy" eyebrow="HEALTH PROFILE" onClose={() => setAddAllergy(false)}><form className="modal-form" onSubmit={addNewAllergy}><Field label="Allergen" required><input value={allergyForm.allergen} onChange={e => setAllergyForm({ ...allergyForm, allergen: e.target.value })} placeholder="e.g. medicine, food, material" autoFocus /></Field><Field label="Recorded reaction"><input value={allergyForm.reaction} onChange={e => setAllergyForm({ ...allergyForm, reaction: e.target.value })} placeholder="If known" /></Field><Field label="Severity as reported"><select value={allergyForm.severity} onChange={e => setAllergyForm({ ...allergyForm, severity: e.target.value as Allergy['severity'] })}><option value="mild">Mild</option><option value="moderate">Moderate</option><option value="severe">Severe</option></select></Field><div className="patient-reported-note"><Info size={14} /> This will be labeled patient-reported, not clinician-confirmed.</div>{error && <div className="form-error">{error}</div>}<div className="modal-foot"><Button variant="outline" onClick={() => setAddAllergy(false)}>Cancel</Button><Button type="submit">Save allergy</Button></div></form></Modal>
  </div>
}

function scopeSummary(scope: GrantScope) {
  if (scope.type === 'all') return 'All records and health summary'
  if (scope.type === 'categories') return scope.categories.map(c => CATEGORY_LABELS[c]).join(', ')
  return `${scope.recordIds.length} selected record${scope.recordIds.length === 1 ? '' : 's'}`
}
function grantState(grant: { status: string; expiresAt: string }) { return grant.status === 'revoked' ? 'revoked' : isExpired(grant.expiresAt) ? 'expired' : grant.status }

export function PatientSharingPage() {
  const { db, currentUser } = useStore()
  const [shareOpen, setShareOpen] = useState(false)
  const [targetRequest, setTargetRequest] = useState<AccessRequest | null>(null)
  const grants = db.grants.filter(g => g.patientId === currentUser?.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const requests = db.accessRequests.filter(r => r.patientId === currentUser?.id && r.status === 'pending')
  const active = grants.filter(g => grantState(g) === 'active')
  const history = grants.filter(g => grantState(g) !== 'active')
  const launchGrant = (request?: AccessRequest) => { setTargetRequest(request || null); setShareOpen(true) }
  return <div className="page-stack"><PageTitle eyebrow="CONSENT CENTER" title="Sharing & access" description="Choose which registered clinician sees what, and for how long." action={<Button onClick={() => launchGrant()}><HeartHandshake size={16} /> Share records</Button>} /><div className="sharing-privacy-callout"><span><ShieldCheck size={19} /></span><div><b>You’re in control of every share.</b><p>Doctors can only access records covered by an active grant. Expiry and revocation are checked whenever a record is opened in this demo.</p></div><Badge tone="teal">Consent-first</Badge></div>
    {requests.length > 0 && <section className="panel requests-panel"><div className="panel-heading"><div><div className="eyebrow">WAITING FOR YOUR DECISION</div><h2>Pending doctor requests</h2></div><Badge tone="amber">{requests.length} pending</Badge></div><div className="pending-share-list">{requests.map(request => <PendingRequestCard key={request.id} request={request} onGrant={() => launchGrant(request)} />)}</div></section>}
    <section className="sharing-section"><div className="sharing-section-head"><div><h2>Active permissions</h2><span>{active.length} active grant{active.length === 1 ? '' : 's'}</span></div><span className="sharing-key"><i className="status-dot" /> Access is currently enabled</span></div>{active.length ? <div className="grant-list">{active.map(grant => <GrantCard key={grant.id} grant={grant} />)}</div> : <div className="panel"><EmptyState icon={<LockKeyhole size={24} />} title="No active shares" description="When you share selected records with a doctor, you’ll see permissions and expiry here." action={<Button onClick={() => launchGrant()}><HeartHandshake size={15} /> Share records</Button>} /></div>}</section>
    <section className="sharing-section"><div className="sharing-section-head"><div><h2>Access history</h2><span>Expired and revoked permissions</span></div></div>{history.length ? <div className="grant-list">{history.map(grant => <GrantCard key={grant.id} grant={grant} />)}</div> : <div className="quiet-empty">No expired or revoked grants yet.</div>}</section>
    <div className="fictional-notice"><Info size={14} /> Access enforcement in this prototype is simulated in the browser. Production sharing requires server-enforced authorization and private file storage.</div>
    <ShareGrantModal open={shareOpen} request={targetRequest} onClose={() => { setShareOpen(false); setTargetRequest(null) }} />
  </div>
}

function PendingRequestCard({ request, onGrant }: { request: AccessRequest; onGrant: () => void }) {
  const { db, respondToRequest } = useStore()
  const toast = useToast()
  const doctor = db.profiles.find(p => p.id === request.doctorId)
  const info = db.doctors.find(d => d.profileId === request.doctorId)
  return <div className="pending-share-card"><div className="request-doctor-avatar"><Stethoscope size={16} /></div><div className="request-copy"><b>{doctor?.name || 'Registered doctor'}</b><small>{info?.specialization} · {info?.hospital}</small><p>{request.message || 'Requesting access to selected records.'}</p><span><Clock3 size={12} /> {fmtDateTime(request.createdAt)}</span></div><div className="pending-share-actions"><Button size="sm" onClick={onGrant}>Review & choose access</Button><Button size="sm" variant="outline" onClick={() => { respondToRequest(request.id); toast('Request declined.') }}>Decline</Button></div></div>
}

function GrantCard({ grant }: { grant: ReturnType<typeof useStore>['db']['grants'][number] }) {
  const { db, revokeGrant } = useStore()
  const toast = useToast()
  const doctor = db.profiles.find(p => p.id === grant.doctorId)
  const info = db.doctors.find(d => d.profileId === grant.doctorId)
  const status = grantState(grant)
  return <article className={`grant-card grant-${status}`}><div className="grant-doctor"><span className="doctor-avatar"><Stethoscope size={17} /></span><span><b>{doctor?.name || 'Registered doctor'}</b><small>{info?.specialization || 'Specialist'} · {info?.hospital || 'Clinic not recorded'}</small></span></div><div className="grant-scope"><small>ACCESS SCOPE</small><b>{scopeSummary(grant.scope)}</b>{grant.label && <span>{grant.label}</span>}</div><div className="grant-time"><span><small>GRANTED</small>{fmtDate(grant.createdAt)}</span><span><small>EXPIRES</small>{fmtDateTime(grant.expiresAt)}</span></div><div className="grant-status"><Badge tone={status === 'active' ? 'green' : status === 'expired' ? 'amber' : 'neutral'}>{status === 'active' ? 'Active' : status === 'expired' ? 'Expired' : 'Revoked'}</Badge>{status === 'active' && <Button size="sm" variant="outline" className="revoke-button" onClick={() => { if (window.confirm(`Revoke access for ${doctor?.name || 'this doctor'} now? They will no longer be able to open records covered by this grant.`)) { const result = revokeGrant(grant.id); if (result.ok) toast('Access revoked immediately in the demo.') } }}><X size={14} /> Revoke</Button>}{status === 'revoked' && grant.revokedAt && <small className="revoked-label">Revoked {fmtDate(grant.revokedAt)}</small>}</div></article>
}

function ShareGrantModal({ open, request, onClose }: { open: boolean; request: AccessRequest | null; onClose: () => void }) {
  const { db, currentUser, createGrant } = useStore()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [doctorId, setDoctorId] = useState(request?.doctorId || '')
  const [scopeType, setScopeType] = useState<'all' | 'categories' | 'records'>('records')
  const [selectedCategories, setSelectedCategories] = useState<RecordCategory[]>(['blood_test'])
  const [selectedRecords, setSelectedRecords] = useState<string[]>([])
  const [duration, setDuration] = useState('24')
  const [customExpiry, setCustomExpiry] = useState('')
  const [consent, setConsent] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    if (open) {
      setDoctorId(request?.doctorId || '')
      setSearch('')
      setScopeType('records')
      setSelectedCategories(['blood_test'])
      setSelectedRecords([])
      setDuration('24')
      setCustomExpiry('')
      setConsent(false)
      setError('')
    }
  }, [open, request])
  const records = db.records.filter(r => r.patientId === currentUser?.id).sort((a, b) => b.date.localeCompare(a.date))
  const doctors = db.doctors.map(d => ({ doctor: d, profile: db.profiles.find(p => p.id === d.profileId)! })).filter(row => row.profile && `${row.profile.name} ${row.doctor.specialization} ${row.doctor.hospital}`.toLowerCase().includes(search.toLowerCase()))
  const toggleCategory = (category: RecordCategory) => setSelectedCategories(prev => prev.includes(category) ? prev.filter(c => c !== category) : [...prev, category])
  const submit = () => {
    setError('')
    if (!doctorId) return setError('Choose a registered doctor.')
    if (!consent) return setError('Confirm consent to continue.')
    if (duration === 'custom' && (!customExpiry || new Date(customExpiry).getTime() <= Date.now())) return setError('Choose a future expiry date and time.')
    const scope: GrantScope = scopeType === 'all' ? { type: 'all' } : scopeType === 'categories' ? { type: 'categories', categories: selectedCategories } : { type: 'records', recordIds: selectedRecords }
    const expiry = duration === 'custom' ? new Date(customExpiry).toISOString() : new Date(Date.now() + Number(duration) * 60 * 60 * 1000).toISOString()
    const response = createGrant({ doctorId, scope, expiresAt: expiry, requestId: request?.id })
    if (!response.ok) return setError(response.error || 'Could not create sharing permission.')
    toast('Consent recorded. The doctor can now access only the scope you selected.')
    onClose(); setConsent(false); setDoctorId(''); setSelectedRecords([]); setScopeType('records')
  }
  if (!open) return null
  return <Modal open={open} title="Share selected records" eyebrow="YOUR CONSENT" onClose={onClose} wide><div className="share-modal-intro"><span className="share-intro-icon"><ShieldCheck size={19} /></span><div><b>You choose the access scope and expiry.</b><small>Doctors cannot extend or approve their own access.</small></div></div><div className="share-step"><div className="step-heading"><span>01</span><div><b>Choose a registered doctor</b><small>Search the demo directory. No patient records are shown to doctors until you grant access.</small></div></div><div className="doctor-picker-search"><Search size={15} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search doctor, clinic or specialty…" /></div><div className="doctor-picker-list">{doctors.map(({ doctor, profile }) => <button key={doctor.profileId} className={`doctor-picker-option ${doctorId === doctor.profileId ? 'selected' : ''}`} onClick={() => setDoctorId(doctor.profileId)}><span className="doctor-picker-avatar"><Stethoscope size={16} /></span><span><b>{profile.name}</b><small>{doctor.specialization} · {doctor.hospital}</small></span><span className={`radio-dot ${doctorId === doctor.profileId ? 'checked' : ''}`} /></button>)}{doctors.length === 0 && <div className="quiet-empty">No registered doctors match that search.</div>}</div></div><div className="share-step"><div className="step-heading"><span>02</span><div><b>Select exactly what to share</b><small>Full access includes profile summary and all records; limited grants only include their selected scope.</small></div></div><div className="scope-options"><label className={`scope-choice ${scopeType === 'records' ? 'scope-selected' : ''}`}><input type="radio" name="scope" checked={scopeType === 'records'} onChange={() => setScopeType('records')} /><span className="scope-choice-copy"><b>Selected records</b><small>Choose individual documents</small></span><Badge tone="teal">Least access</Badge></label><label className={`scope-choice ${scopeType === 'categories' ? 'scope-selected' : ''}`}><input type="radio" name="scope" checked={scopeType === 'categories'} onChange={() => setScopeType('categories')} /><span className="scope-choice-copy"><b>Record categories</b><small>Share chosen document types</small></span></label><label className={`scope-choice ${scopeType === 'all' ? 'scope-selected' : ''}`}><input type="radio" name="scope" checked={scopeType === 'all'} onChange={() => setScopeType('all')} /><span className="scope-choice-copy"><b>All records & health summary</b><small>Includes health profile and all current records</small></span><Badge tone="amber">Broad access</Badge></label></div>{scopeType === 'records' && <div className="scope-record-checklist">{records.map(r => <label key={r.id}><input type="checkbox" checked={selectedRecords.includes(r.id)} onChange={e => setSelectedRecords(prev => e.target.checked ? [...prev, r.id] : prev.filter(id => id !== r.id))} /><span><b>{r.title}</b><small>{fmtDate(r.date)} · {CATEGORY_LABELS[r.category]}</small></span></label>)}{records.length === 0 && <span className="quiet-empty">No records available to share.</span>}</div>}{scopeType === 'categories' && <div className="category-checkbox-grid">{categories.map(([key, label]) => <label key={key}><input type="checkbox" checked={selectedCategories.includes(key)} onChange={() => toggleCategory(key)} /><span>{label}</span></label>)}</div>}</div><div className="share-step"><div className="step-heading"><span>03</span><div><b>Set an expiry</b><small>Access ends automatically at the selected time.</small></div></div><div className="expiry-options">{[['1','1 hour'],['24','24 hours'],['168','7 days'],['custom','Custom']].map(([value, label]) => <button key={value} className={duration === value ? 'active' : ''} onClick={() => setDuration(value)}>{label}</button>)}</div>{duration === 'custom' && <Field label="Expiry date and time" required><input type="datetime-local" value={customExpiry} min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} onChange={e => setCustomExpiry(e.target.value)} /></Field>}</div><div className="consent-confirm"><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /><span>I consent to sharing <b>{scopeType === 'all' ? 'all records and my health summary' : scopeType === 'categories' ? `${selectedCategories.length} selected categories` : `${selectedRecords.length} selected record${selectedRecords.length === 1 ? '' : 's'}`}</b> with <b>{db.profiles.find(p => p.id === doctorId)?.name || 'the selected doctor'}</b> until <b>{duration === 'custom' && customExpiry ? fmtDateTime(new Date(customExpiry).toISOString()) : duration === '1' ? 'one hour from now' : duration === '24' ? '24 hours from now' : '7 days from now'}</b>. I can revoke this access at any time.</span></label></div>{error && <div className="form-error"><AlertCircle size={15} /> {error}</div>}<div className="modal-foot"><span className="local-storage-note"><LockKeyhole size={13} /> Demo consent · local storage</span><div><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit}><ShieldCheck size={15} /> Confirm consent</Button></div></div></Modal>
}

export function PatientAppointmentsPage() {
  const { db, currentUser, mutate, addAudit } = useStore()
  const toast = useToast()
  const [editing, setEditing] = useState<string | null>(null)
  const [note, setNote] = useState('')
  if (!currentUser) return null
  const appointments = db.appointments.filter(a => a.patientId === currentUser.id).sort((a, b) => a.dateTime.localeCompare(b.dateTime))
  const proposed = appointments.filter(a => a.status === 'proposed')
  const upcoming = appointments.filter(a => ['accepted', 'proposed'].includes(a.status) && new Date(a.dateTime).getTime() >= Date.now())
  const past = appointments.filter(a => ['completed', 'cancelled', 'rejected'].includes(a.status) || new Date(a.dateTime).getTime() < Date.now())
  const respond = (a: Appointment, status: Appointment['status']) => {
    mutate(prev => ({ ...prev, appointments: prev.appointments.map(item => item.id === a.id ? { ...item, status } : item) }))
    addAudit('appointment_responded', `${status === 'accepted' ? 'Accepted' : 'Declined'} appointment proposal with ${getProfileName(db, a.doctorId)}.`, currentUser.id)
    toast(status === 'accepted' ? 'Appointment accepted in the demo.' : 'Appointment proposal declined.')
  }
  const saveNote = (a: Appointment) => {
    mutate(prev => ({ ...prev, appointments: prev.appointments.map(item => item.id === a.id ? { ...item, notes: note } : item) }))
    toast('Appointment note saved.'); setEditing(null)
  }
  const card = (a: Appointment) => {
    const doctor = db.profiles.find(p => p.id === a.doctorId)
    const meta = db.doctors.find(d => d.profileId === a.doctorId)
    return <article className="appointment-card" key={a.id}><div className="appt-date-block"><small>{new Date(a.dateTime).toLocaleDateString('en-IN', { month: 'short' }).toUpperCase()}</small><b>{new Date(a.dateTime).getDate()}</b><span>{new Date(a.dateTime).toLocaleDateString('en-IN', { weekday: 'short' })}</span></div><div className="appointment-main"><div className="appointment-heading"><h3>{doctor?.name || 'Healthcare provider'}</h3><Badge tone={a.status === 'accepted' ? 'green' : a.status === 'proposed' ? 'amber' : a.status === 'completed' ? 'blue' : 'neutral'}>{a.status}</Badge></div><p>{meta?.specialization} · {a.clinic}</p><div className="appointment-meta"><span><Clock3 size={14} /> {new Date(a.dateTime).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span><span><Stethoscope size={14} /> {a.createdBy === 'doctor' ? 'Proposed by clinic' : 'Added by you'}</span></div>{a.notes && <div className="appointment-note"><MessageSquareText size={13} /> {a.notes}</div>}</div><div className="appointment-actions">{a.status === 'proposed' && <><Button size="sm" onClick={() => respond(a, 'accepted')}><Check size={14} /> Accept</Button><Button size="sm" variant="outline" onClick={() => respond(a, 'rejected')}>Decline</Button></>}{a.status === 'accepted' && <Button size="sm" variant="outline" onClick={() => { setEditing(a.id); setNote(a.notes || '') }}><Pencil size={14} /> Add note</Button>}</div></article>
  }
  return <div className="page-stack"><PageTitle eyebrow="SIMULATED SCHEDULING" title="Appointments" description="Manage proposed visits and keep a note for your next conversation." action={<Badge tone="blue"><CalendarDays size={13} /> Demo scheduling</Badge>} />{proposed.length > 0 && <section className="appointment-section"><div className="section-line-heading"><div><h2>Needs your response</h2><span>{proposed.length} time{proposed.length === 1 ? '' : 's'} proposed</span></div><Badge tone="amber">Action needed</Badge></div><div className="appointment-list">{proposed.map(card)}</div></section>}<section className="appointment-section"><div className="section-line-heading"><div><h2>Upcoming</h2><span>Confirmed and proposed visits</span></div></div>{upcoming.length ? <div className="appointment-list">{upcoming.map(card)}</div> : <div className="panel"><EmptyState icon={<CalendarDays size={24} />} title="No upcoming appointments" description="Proposed demo appointments from registered doctors appear here." /></div>}</section><section className="appointment-section"><div className="section-line-heading"><div><h2>Past & inactive</h2><span>Completed, declined or previous appointments</span></div></div>{past.length ? <div className="appointment-list appointment-list-past">{past.map(card)}</div> : <div className="quiet-empty">Your past appointment list is empty.</div>}</section><div className="fictional-notice"><Info size={14} /> This is simulated scheduling only. MediVault does not book appointments with real clinics.</div><Modal open={!!editing} title="Appointment note" eyebrow="YOUR PREPARATION" onClose={() => setEditing(null)}><div className="modal-form"><Field label="Private note for your visit"><textarea value={note} onChange={e => setNote(e.target.value)} rows={4} placeholder="Questions, symptoms or topics to remember…" autoFocus /></Field><div className="modal-foot"><Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button><Button onClick={() => { const appt = appointments.find(a => a.id === editing); if (appt) saveNote(appt) }}>Save note</Button></div></div></Modal></div>
}

export function PatientEmergencyPage() {
  const { db, currentUser, mutate, addAudit } = useStore()
  const toast = useToast()
  if (!currentUser) return null
  const patient = db.patients.find(p => p.profileId === currentUser.id)
  const allergies = db.allergies.filter(a => a.patientId === currentUser.id).sort((a,b) => (a.severity === 'severe' ? 0 : 1) - (b.severity === 'severe' ? 0 : 1))
  const activeMeds = db.medications.filter(m => m.patientId === currentUser.id && m.status === 'active')
  const conditions = db.conditions.filter(c => c.patientId === currentUser.id)
  const qr = db.emergencyTokens.find(item => item.patientId === currentUser.id && item.active)
  const qrUrl = qr ? `${window.location.origin}/#emergency/${encodeURIComponent(qr.token)}` : ''
  const requests = db.emergency.filter(item => item.patientId === currentUser.id && ['pending', 'active'].includes(item.status)).sort((a,b)=>b.createdAt.localeCompare(a.createdAt))
  const copy = async () => { try { await navigator.clipboard.writeText(qrUrl); toast('Protected workflow link copied. It contains no health details.') } catch { toast('Copy unavailable. The QR code contains only a demo workflow token.', 'info') } }
  const rotateQr = () => {
    const token = uid('protected-workflow')
    mutate(prev => ({ ...prev, emergencyTokens: [...prev.emergencyTokens.map(item => item.patientId === currentUser.id ? { ...item, active: false } : item), { patientId: currentUser.id, token, createdAt: new Date().toISOString(), active: true }] }))
    addAudit('emergency_access', 'Rotated the protected emergency-workflow QR token. No health information is in the code.', currentUser.id)
    toast('A new protected QR workflow link has been created.')
  }
  const respondEmergency = (id: string, approve: boolean) => {
    const request = db.emergency.find(item => item.id === id && item.patientId === currentUser.id && item.status === 'pending')
    if (!request) return
    if (!window.confirm(approve ? 'Authorize this clinician to view essential emergency-card fields for 30 minutes? They will not receive access to full records.' : 'Decline this emergency-access request?')) return
    if (approve && !db.emergencyTokens.some(token => token.patientId === currentUser.id && token.active && token.token === request.token)) { toast('This QR token was rotated. The old request cannot be authorized.', 'error'); return }
    mutate(prev => ({ ...prev, emergency: prev.emergency.map(item => item.id === id ? { ...item, status: approve ? 'active' as const : 'rejected' as const, expiresAt: approve ? new Date(Date.now() + 30 * 60000).toISOString() : item.expiresAt, authorizedBy: approve ? 'patient' : undefined } : item) }))
    addAudit('emergency_access', approve ? 'Explicitly authorized temporary, essential-only emergency access.' : 'Declined an emergency-access request.', currentUser.id)
    toast(approve ? 'Essential-only emergency access authorized for 30 minutes.' : 'Emergency request declined.', 'info')
  }
  const revokeEmergency = (id: string) => {
    mutate(prev => ({ ...prev, emergency: prev.emergency.map(item => item.id === id ? { ...item, status: 'expired' as const } : item) }))
    addAudit('emergency_access', 'Revoked temporary emergency access.', currentUser.id)
    toast('Temporary emergency access revoked.')
  }
  return <div className="page-stack"><PageTitle eyebrow="ESSENTIAL INFORMATION ONLY" title="Emergency health card" description="A quick reference for essential details. Your full medical history is never placed in the QR code." action={<Button variant="outline" onClick={() => window.print()}><ArrowDownToLine size={15} /> Print card</Button>} /><div className="emergency-warning"><ShieldAlert size={18} /><span><b>Demo emergency card — not an official medical ID.</b> Always contact local emergency services. This card does not replace a clinician’s assessment.</span></div><div className="emergency-layout"><section className="emergency-card-preview"><div className="emergency-card-top"><div className="emergency-logo"><div className="brand-mark small"><HeartPulse size={14} /></div><span>MediVault</span></div><Badge tone="red"><i className="status-dot" /> DEMO CARD</Badge></div><div className="emergency-person"><div className="emergency-avatar">{currentUser.name.split(' ').map(w => w[0]).slice(0, 2).join('')}</div><div><h2>{currentUser.name}</h2><span>Patient identifier · {patient?.patientId}</span></div></div><div className="emergency-card-divide" /><div className="emergency-essential-grid"><div><div className="emergency-field-label"><AlertCircle size={14} /> RECORDED ALLERGIES</div>{allergies.length ? allergies.map(a => <b className={`emergency-value ${a.severity === 'severe' ? 'danger-value' : ''}`} key={a.id}>{a.allergen} <small>· {a.reaction || 'reaction not recorded'} · {a.confirmed ? 'confirmed' : 'patient-reported'}</small></b>) : <span className="emergency-value">No allergy entries <small>· status not confirmed</small></span>}</div><div><div className="emergency-field-label"><HeartPulse size={14} /> CURRENT MEDICATIONS</div>{activeMeds.length ? activeMeds.map(m => <b className="emergency-value" key={m.id}>{m.name} <small>· {m.dose || 'dose not recorded'}</small></b>) : <span className="emergency-value">No active entries</span>}</div><div><div className="emergency-field-label"><Activity size={14} /> CHRONIC CONDITIONS</div>{conditions.length ? conditions.map(c => <b className="emergency-value" key={c.id}>{c.condition} <small>· {c.confirmed ? 'confirmed' : 'patient-reported'}</small></b>) : <span className="emergency-value">None recorded</span>}</div><div><div className="emergency-field-label"><UsersRound size={14} /> EMERGENCY CONTACT</div>{patient?.emergencyContactName ? <><b className="emergency-value">{patient.emergencyContactName}</b><small className="emergency-contact-detail">{patient.emergencyContactRelation} · {patient.emergencyContactPhone}</small></> : <span className="emergency-value">Not recorded</span>}</div></div><div className="emergency-card-bottom"><span><LockKeyhole size={13} /> Essential demo details only</span><span>Last updated · {new Date().toLocaleDateString('en-IN')}</span></div></section><aside className="qr-workflow-card"><div className="eyebrow">PROTECTED ACCESS WORKFLOW</div><h3>QR code shares no medical data</h3><p>Scanning opens the doctor sign-in and emergency-request workflow. A reason and explicit authorization are required before any access.</p>{qr ? <><div className="qr-code-wrap"><QRCodeSVG value={qrUrl} size={152} bgColor="#ffffff" fgColor="#12344a" level="M" includeMargin /></div><div className="qr-protect-label"><ShieldCheck size={14} /> No health details in this code</div><Button variant="outline" className="copy-workflow-btn" onClick={copy}>Copy protected workflow link</Button><small className="qr-demo-url">Token created {fmtDate(qr.createdAt)} · local demo workflow only</small><button className="text-action rotate-qr-button" onClick={rotateQr}>Rotate QR token <ArrowRight size={13} /></button></> : <><div className="qr-placeholder"><LockKeyhole size={23} /><span>No active QR token yet</span></div><Button variant="outline" onClick={rotateQr}>Create protected QR link</Button></>}</aside></div>
    {requests.length > 0 && <section className="panel emergency-requests-panel"><div className="panel-heading"><div><div className="eyebrow">TIME-LIMITED REQUESTS</div><h2>Emergency access requests</h2></div><Badge tone="amber">Essential information only</Badge></div><div className="emergency-request-list">{requests.map(request => { const doctor = db.profiles.find(p => p.id === request.doctorId); const meta = db.doctors.find(d => d.profileId === request.doctorId); const pending = request.status === 'pending'; const active = request.status === 'active' && !isExpired(request.expiresAt); return <div className="emergency-patient-request" key={request.id}><span className="request-doctor-avatar"><Stethoscope size={16} /></span><div><b>{doctor?.name || 'Registered clinician'}</b><small>{meta?.specialization} · {fmtDateTime(request.createdAt)}</small><p>{request.reason}</p><span className="emergency-expiry"><Clock3 size={12} /> {pending ? 'Awaiting your authorization' : active ? `Authorized until ${fmtDateTime(request.expiresAt)}` : 'Access expired'}</span></div>{pending ? <div className="request-actions"><Button size="sm" onClick={() => respondEmergency(request.id, true)}>Authorize 30 min</Button><Button size="sm" variant="outline" onClick={() => respondEmergency(request.id, false)}>Decline</Button></div> : active ? <Button size="sm" variant="outline" onClick={() => revokeEmergency(request.id)}><X size={14} /> Revoke now</Button> : <Badge tone="neutral">Expired</Badge>}</div>})}</div></section>}
    <div className="emergency-policy"><LockKeyhole size={16} /><div><b>Emergency access is not a consent bypass</b><p>A clinician must provide a reason, and you must explicitly approve a narrow, 30-minute request; no emergency-role bypass is configured. It exposes essential card fields only — never full records.</p></div></div></div>
}

export function PatientActivityPage() {
  const { db, currentUser } = useStore()
  if (!currentUser) return null
  const logs = db.audit.filter(a => a.targetPatientId === currentUser.id || (a.actorId === currentUser.id && !a.targetPatientId))
  const actionLabel: Record<string, string> = { login: 'Signed in', logout: 'Signed out', record_upload: 'Record or profile updated', record_view: 'Record viewed', record_download: 'Record downloaded', record_delete: 'Record deleted', grant_created: 'Access granted', grant_revoked: 'Access revoked', request_created: 'Access requested', request_responded: 'Request response', note_created: 'Clinical note added', appointment_responded: 'Appointment response', emergency_access: 'Emergency workflow', summary_generated: 'Summary generated' }
  return <div className="page-stack"><PageTitle eyebrow="TRANSPARENCY & CONTROL" title="Activity log" description="A readable demo history of important changes and record access." action={<Badge tone="blue"><ClipboardCheck size={13} /> {logs.length} entries</Badge>} /><div className="audit-notice"><ShieldCheck size={18} /><div><b>Activity is logged without document contents or credentials.</b><p>These events live in this browser demo and are not a production security audit trail.</p></div></div><section className="panel audit-panel">{logs.length ? <div className="audit-list">{logs.map(log => <div className="audit-row" key={log.id}><span className={`audit-icon audit-${log.action}`}><AuditIcon action={log.action} /></span><div className="audit-description"><b>{actionLabel[log.action] || log.action.replace('_', ' ')}</b><p>{log.detail}</p><span>{log.actorName} · {log.actorRole === 'doctor' ? 'Doctor' : 'Patient'} · {fmtDateTime(log.timestamp)}</span></div><Badge tone={log.actorRole === 'doctor' ? 'blue' : 'neutral'}>{log.actorRole === 'doctor' ? 'Clinician' : 'You'}</Badge></div>)}</div> : <EmptyState icon={<BookOpenCheck size={24} />} title="No activity yet" description="Uploads, access grants and important changes will appear here." />}</section><div className="fictional-notice"><Info size={14} /> Activity details are simulated and may not include actions from before this browser session.</div></div>
}

function AuditIcon({ action }: { action: string }) {
  if (action.includes('grant') || action.includes('revoked')) return <ShieldCheck size={16} />
  if (action.includes('record')) return <FileText size={16} />
  if (action.includes('note')) return <MessageSquareText size={16} />
  if (action.includes('login')) return <UserRound size={16} />
  if (action.includes('appointment')) return <CalendarDays size={16} />
  return <Activity size={16} />
}
