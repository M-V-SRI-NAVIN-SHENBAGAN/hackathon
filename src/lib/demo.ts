import type { DBState, MedicalRecord } from './types'
import { dateOnly, uid } from './utils'

export const DEMO_IDS = {
  patient: 'demo-patient',
  priya: 'demo-doctor-priya',
  karthik: 'demo-doctor-karthik',
}

const dateMonthsAgo = (months: number, day = 9) => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() - months)
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()))
  return dateOnly(d)
}
const dateDaysFromNow = (days: number, hour = 10) => {
  const d = new Date()
  d.setDate(d.getDate() + days)
  d.setHours(hour, 30, 0, 0)
  return d.toISOString()
}
const makeRecord = (
  id: string,
  title: string,
  category: MedicalRecord['category'],
  monthsAgo: number,
  provider: string,
  notes: string,
  extras: Partial<MedicalRecord> = {},
): MedicalRecord => ({
  id,
  patientId: DEMO_IDS.patient,
  title,
  category,
  date: dateMonthsAgo(monthsAgo),
  provider,
  notes,
  tags: [],
  uploadedAt: dateMonthsAgo(monthsAgo),
  uploadedBy: DEMO_IDS.patient,
  ...extras,
})

export function createInitialState(): DBState {
  const now = new Date().toISOString()
  const records: MedicalRecord[] = [
    makeRecord('r-a1c-old', 'HbA1c — routine review', 'blood_test', 12, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['diabetes review', 'lab'], labResults: [{ test: 'HbA1c', value: '7.4', numericValue: 7.4, unit: '%', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-glucose-1', 'Fasting blood glucose', 'blood_test', 11, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['glucose', 'lab'], labResults: [{ test: 'Fasting glucose', value: '138', numericValue: 138, unit: 'mg/dL', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-bp-1', 'Blood pressure reading', 'other', 10, 'Dr. Priya Raman · Northstar Clinic', 'Recorded at a fictional consultation.', {
      tags: ['vitals'], bloodPressure: { systolic: 132, diastolic: 84 },
    }),
    makeRecord('r-glucose-2', 'Fasting blood glucose', 'blood_test', 9, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['glucose', 'lab'], labResults: [{ test: 'Fasting glucose', value: '129', numericValue: 129, unit: 'mg/dL', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-glucose-duplicate', 'Fasting blood glucose — duplicate copy', 'blood_test', 9, 'Harborview Diagnostics', 'Seeded duplicate example. Review before keeping both copies.', {
      tags: ['glucose', 'possible duplicate'], fileName: 'glucose-report-copy.pdf',
      labResults: [{ test: 'Fasting glucose', value: '129', numericValue: 129, unit: 'mg/dL', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-a1c-mid', 'HbA1c — follow-up', 'blood_test', 7, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['diabetes review', 'lab'], labResults: [{ test: 'HbA1c', value: '7.0', numericValue: 7.0, unit: '%', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-thyroid', 'Thyroid profile (TSH)', 'blood_test', 6, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['thyroid', 'lab'], labResults: [{ test: 'TSH', value: '2.6', numericValue: 2.6, unit: 'mIU/L', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-bp-2', 'Blood pressure reading', 'other', 4, 'Dr. Priya Raman · Northstar Clinic', 'Recorded at a fictional consultation.', {
      tags: ['vitals'], bloodPressure: { systolic: 128, diastolic: 82 },
    }),
    makeRecord('r-rx-old', 'Prescription — vitamin D', 'prescription', 3, 'Dr. Priya Raman · Northstar Clinic', 'Fictional prescription document. Not a valid prescription.', {
      tags: ['prescription', 'draft data'],
    }),
    makeRecord('r-glucose-3', 'Fasting blood glucose', 'blood_test', 2, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      tags: ['glucose', 'lab'], labResults: [{ test: 'Fasting glucose', value: '122', numericValue: 122, unit: 'mg/dL', referenceRange: 'As reported by lab' }],
    }),
    makeRecord('r-rx-current', 'Prescription — medication review', 'prescription', 1, 'Dr. Priya Raman · Northstar Clinic', 'Fictional prescription record. For demonstration only; follow a licensed clinician’s advice.', {
      tags: ['prescription'],
    }),
    makeRecord('r-a1c-new', 'HbA1c — latest result', 'blood_test', 0, 'Harborview Diagnostics', 'Fictional sample report. Values are for product demonstration only.', {
      date: dateOnly(new Date()), tags: ['diabetes review', 'lab'],
      labResults: [{ test: 'HbA1c', value: '6.8', numericValue: 6.8, unit: '%', referenceRange: 'As reported by lab' }],
    }),
  ]

  const requestId = 'req-karthik-pending'
  return {
    profiles: [
      { id: DEMO_IDS.patient, role: 'patient', email: 'arjun.demo@medivault.test', name: 'Arjun Kumar', createdAt: now },
      { id: DEMO_IDS.priya, role: 'doctor', email: 'priya.demo@medivault.test', name: 'Dr. Priya Raman', createdAt: now },
      { id: DEMO_IDS.karthik, role: 'doctor', email: 'karthik.demo@medivault.test', name: 'Dr. Karthik Raj', createdAt: now },
    ],
    patients: [{
      profileId: DEMO_IDS.patient,
      patientId: 'MV-2026-0142',
      dob: '1988-06-14', gender: 'Male', phone: '+91 98765 43210', bloodGroup: 'O+',
      address: 'Chennai, Tamil Nadu', emergencyContactName: 'Meera Kumar', emergencyContactPhone: '+91 98400 12345', emergencyContactRelation: 'Spouse',
    }],
    doctors: [
      { profileId: DEMO_IDS.priya, specialization: 'General Physician', hospital: 'Northstar Clinic', registrationNumber: 'TN-MC-DEMO-2148' },
      { profileId: DEMO_IDS.karthik, specialization: 'Endocrinologist', hospital: 'CityCare Medical Centre', registrationNumber: 'TN-MC-DEMO-3902' },
    ],
    records,
    medications: [
      { id: 'med-metformin', patientId: DEMO_IDS.patient, name: 'Metformin', dose: '500 mg', frequency: 'As recorded in sample plan', startDate: dateMonthsAgo(11), prescribingDoctor: 'Dr. Priya Raman', status: 'active', instructions: 'Fictional demo entry — confirm all medicines with your clinician.', addedBy: DEMO_IDS.patient },
      { id: 'med-vitd', patientId: DEMO_IDS.patient, name: 'Vitamin D3', dose: 'Not recorded', frequency: 'Not recorded', startDate: dateMonthsAgo(8), endDate: dateMonthsAgo(3), prescribingDoctor: 'Dr. Priya Raman', status: 'discontinued', instructions: 'Historical fictional entry.', addedBy: DEMO_IDS.patient },
    ],
    medReviews: [],
    allergies: [{ id: 'allergy-penicillin', patientId: DEMO_IDS.patient, allergen: 'Penicillin', reaction: 'Rash (patient-reported)', severity: 'moderate', confirmed: false, recordedBy: 'Patient-reported', dateRecorded: dateMonthsAgo(11) }],
    conditions: [{ id: 'condition-t2d', patientId: DEMO_IDS.patient, condition: 'Type 2 diabetes', diagnosedDate: dateMonthsAgo(12), confirmed: true, recordedBy: 'Dr. Priya Raman', notes: 'Fictional sample diagnosis for demonstrating a longitudinal record.' }],
    surgeries: [],
    appointments: [
      { id: 'appt-upcoming', patientId: DEMO_IDS.patient, doctorId: DEMO_IDS.priya, dateTime: dateDaysFromNow(5, 11), clinic: 'Northstar Clinic', status: 'accepted', notes: 'Bring recent reports if available.', createdBy: 'doctor' },
      { id: 'appt-proposed', patientId: DEMO_IDS.patient, doctorId: DEMO_IDS.karthik, dateTime: dateDaysFromNow(9, 15), clinic: 'CityCare Medical Centre', status: 'proposed', notes: 'Proposed follow-up time. Please accept or suggest another time with the clinic.', createdBy: 'doctor' },
    ],
    accessRequests: [{ id: requestId, doctorId: DEMO_IDS.karthik, patientId: DEMO_IDS.patient, status: 'pending', message: 'Requesting access to selected records for a follow-up consultation.', createdAt: new Date(Date.now() - 1000 * 60 * 60 * 4).toISOString() }],
    grants: [{
      id: 'grant-priya-seed', patientId: DEMO_IDS.patient, doctorId: DEMO_IDS.priya,
      scope: { type: 'all' }, status: 'active', label: 'Seeded demo consent · revoke at any time',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 6).toISOString(),
    }],
    notes: [{
      id: 'note-seed-priya', patientId: DEMO_IDS.patient, doctorId: DEMO_IDS.priya,
      visitDate: dateMonthsAgo(4), chiefComplaint: 'Routine follow-up',
      observations: 'Fictional demonstration note. Review the source records and verify all information.',
      assessment: 'Recorded history reviewed; no autonomous assessment is generated by MediVault.',
      plan: 'Sample plan entry for UI demonstration only.', followUpDate: dateOnly(new Date(Date.now() + 1000 * 60 * 60 * 24 * 30)),
      createdAt: dateMonthsAgo(4),
    }],
    prescriptionDrafts: [],
    diagnoses: [],
    audit: [
      { id: uid('audit'), timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(), actorId: DEMO_IDS.patient, actorName: 'Arjun Kumar', actorRole: 'patient', action: 'grant_created', targetPatientId: DEMO_IDS.patient, detail: 'Demo consent granted to Dr. Priya Raman · all records.' },
    ],
    emergency: [],
    emergencyTokens: [{ patientId: DEMO_IDS.patient, token: 'mv-demo-arjun-emergency-qr-2026', createdAt: now, active: true }],
    intake: [],
    recentViews: [],
    session: null,
  }
}

export const CATEGORY_LABELS: Record<MedicalRecord['category'], string> = {
  prescription: 'Prescription',
  blood_test: 'Blood test',
  imaging: 'Imaging & scan',
  discharge_summary: 'Discharge summary',
  diagnosis: 'Diagnosis',
  vaccination: 'Vaccination',
  allergy: 'Allergy record',
  other: 'Other document',
}
