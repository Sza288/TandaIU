export type PermitStatus = 'pending' | 'approved' | 'rejected';

export type Permit = {
  id: string;
  sessionId: string;
  studentId: string;
  studentName: string;
  reason: string;
  status: PermitStatus;
  createdAt: string; // ISO 8601
  reviewedAt?: string; // ISO 8601
  reviewedBy?: string;
};
