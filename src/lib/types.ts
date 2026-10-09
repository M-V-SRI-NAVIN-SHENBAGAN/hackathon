// MediVault — shared domain types.
// NOTE: This is a hackathon DEMO. All data is simulated and stored locally
// in the browser (localStorage). No real patient data is involved.

export type Role = 'patient' | 'doctor';

export interface Profile {
  id: string;
  role: Role;
  email: string;
  /** Local demo password verifier only; raw passwords are never persisted. */
  passwordHash?: string;
  passwordSalt?: string;
  name: string;
  createdAt: string;
}

export interface PatientProfile {
  profileId: string;
  /** System-generated unique patient identifier, e.g. MV-2026-0142 */
  patientId: string;
  dob: string;
  gender?: string;
  phone?: string;
  bloodGroup?: string;
  address?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
  emergencyContactRelation?: string;
}

export interface DoctorProfile {
  profileId: string;
  specialization: string;
  hospital: string;
  registrationNumber: string;
}

export type RecordCategory =
  | 'prescription'
  | 'blood_test'
  | 'imaging'
  | 'discharge_summary'
  | 'diagnosis'
  | 'vaccination'
  | 'allergy'
  | 'other';

export interface LabResult {
  test: string;
  value: string;
  numericValue?: number;
  unit: string;
  referenceRange?: string;
}

export interface MedicalRecord {
  id: string;
  patientId: string; // profile id of the owning patient
  title: string;
  category: RecordCategory;
  date: string; // ISO date
  provider: string;
  notes?: string;
  tags: string[];
  fileName?: string;
  fileType?: string;
  /** DEMO ONLY: data URL kept in localStorage. Real apps use private storage buckets. */
  fileData?: string;
  uploadedAt: string;
  uploadedBy: string;
  labResults?: LabResult[];
  bloodPressure?: { systolic: number; diastolic: number };
}

export type MedStatus = 'active' | 'discontinued';

export interface Medication {
  id: string;
  patientId: string;
  name: string;
  dose?: string;
  frequency?: string;
  startDate: string;
  endDate?: string;
  prescribingDoctor?: string;
  status: MedStatus;
  instructions?: string;
  addedBy: string; // 'patient' or a doctor profile id
}

export interface MedicationReview {
  medicationId: string;
  doctorId: string;
  outcome: 'reviewed' | 'continued' | 'changed' | 'discontinued';
  note?: string;
  reviewedAt: string;
}

export interface Allergy {
  id: string;
  patientId: string;
  allergen: string;
  reaction?: string;
  severity?: 'mild' | 'moderate' | 'severe';
  /** false = patient-reported, true = clinician-confirmed */
  confirmed: boolean;
  recordedBy: string;
  dateRecorded: string;
}

export interface ChronicCondition {
  id: string;
  patientId: string;
  condition: string;
  diagnosedDate?: string;
  confirmed: boolean;
  recordedBy: string;
  notes?: string;
}

export interface Surgery {
  id: string;
  patientId: string;
  procedure: string;
  date?: string;
  hospital?: string;
  notes?: string;
  recordedBy: string;
}

export type AppointmentStatus = 'proposed' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

export interface Appointment {
  id: string;
  patientId: string;
  doctorId: string;
  dateTime: string; // ISO datetime
  clinic: string;
  status: AppointmentStatus;
  notes?: string;
  createdBy: Role;
}

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';

export interface AccessRequest {
  id: string;
  doctorId: string;
  patientId: string;
  status: AccessRequestStatus;
  message?: string;
  createdAt: string;
  respondedAt?: string;
}

export type GrantScope =
  | { type: 'all' }
  | { type: 'categories'; categories: RecordCategory[] }
  | { type: 'records'; recordIds: string[] };

export type GrantStatus = 'active' | 'revoked' | 'expired';

export interface SharingGrant {
  id: string;
  patientId: string;
  doctorId: string;
  scope: GrantScope;
  status: GrantStatus;
  label?: string;
  createdAt: string;
  expiresAt: string;
  revokedAt?: string;
}

export interface PrescriptionDraft {
  id: string;
  patientId: string;
  doctorId: string;
  medicine: string;
  dose?: string;
  frequency?: string;
  instructions?: string;
  createdAt: string;
  status: 'draft';
}

export interface ConsultationNote {
  id: string;
  patientId: string;
  doctorId: string;
  visitDate: string;
  chiefComplaint: string;
  observations: string;
  assessment: string;
  plan: string;
  followUpDate?: string;
  createdAt: string;
}

export interface Diagnosis {
  id: string;
  patientId: string;
  doctorId?: string;
  condition: string;
  date: string;
  confirmed: boolean;
  notes?: string;
}

export type AuditAction =
  | 'login'
  | 'logout'
  | 'record_upload'
  | 'record_view'
  | 'record_download'
  | 'record_delete'
  | 'grant_created'
  | 'grant_revoked'
  | 'request_created'
  | 'request_responded'
  | 'note_created'
  | 'appointment_responded'
  | 'emergency_access'
  | 'summary_generated';

export interface AuditLog {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: Role;
  action: AuditAction;
  targetPatientId?: string;
  detail: string;
}

export interface EmergencyQrCode {
  patientId: string;
  token: string;
  createdAt: string;
  active: boolean;
}

export interface EmergencyAccess {
  id: string;
  token: string;
  patientId: string;
  doctorId: string;
  reason: string;
  createdAt: string;
  expiresAt: string;
  status: 'pending' | 'active' | 'rejected' | 'expired';
  authorizedBy?: string;
}

export interface MedicationIntake {
  medicationId: string;
  date: string; // YYYY-MM-DD
  status: 'taken' | 'missed';
}

export interface DoctorRecentView {
  doctorId: string;
  patientId: string;
  at: string;
}

export interface DBState {
  profiles: Profile[];
  patients: PatientProfile[];
  doctors: DoctorProfile[];
  records: MedicalRecord[];
  medications: Medication[];
  medReviews: MedicationReview[];
  allergies: Allergy[];
  conditions: ChronicCondition[];
  surgeries: Surgery[];
  appointments: Appointment[];
  accessRequests: AccessRequest[];
  grants: SharingGrant[];
  notes: ConsultationNote[];
  prescriptionDrafts: PrescriptionDraft[];
  diagnoses: Diagnosis[];
  audit: AuditLog[];
  emergency: EmergencyAccess[];
  emergencyTokens: EmergencyQrCode[];
  intake: MedicationIntake[];
  recentViews: DoctorRecentView[];
  session: { profileId: string } | null;
}

export class AccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AccessDeniedError';
  }
}
