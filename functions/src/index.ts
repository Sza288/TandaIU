import { createHash, randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue, Timestamp, type DocumentData, type Transaction } from 'firebase-admin/firestore';
import { setGlobalOptions } from 'firebase-functions/v2';
import { HttpsError, onCall } from 'firebase-functions/v2/https';
import { getSessionTimeFailure } from './sessionWindow.js';

initializeApp();
setGlobalOptions({ region: 'us-central1' });
const db = getFirestore();

const MAX_ACCURACY_METERS = 50;
const MAX_LAB_RADIUS_METERS = 500;
const ATTENDANCE_QR_PREFIX = 'TANDAIU-ATTENDANCE:1:';
const ATTENDANCE_QR_TTL_MS = 2 * 60 * 1000;

function isFiniteCoordinate(value: unknown, minimum: number, maximum: number): value is number {
  return typeof value === 'number'
    && Number.isFinite(value)
    && value >= minimum
    && value <= maximum;
}

export function haversineMeters(
  latitude1: number,
  longitude1: number,
  latitude2: number,
  longitude2: number,
): number {
  const radians = (degrees: number) => degrees * Math.PI / 180;
  const earthRadius = 6_371_000;
  const lat1 = radians(latitude1);
  const lat2 = radians(latitude2);
  const latDelta = radians(latitude2 - latitude1);
  const lonDelta = radians(longitude2 - longitude1);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(lonDelta / 2) ** 2;
  return 2 * earthRadius * Math.asin(Math.sqrt(a));
}

type CallableErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'failed-precondition'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'deadline-exceeded';

function reject(
  code: CallableErrorCode,
  message: string,
  details?: Record<string, unknown>,
): never {
  throw new HttpsError(code, message, details);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function getCallableData(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) reject('invalid-argument', 'Data permintaan tidak valid.');
  return value;
}

type AttendanceMethod = 'location' | 'qr';

function timestampToMillis(value: unknown): number | null {
  if (value instanceof Timestamp) {
    const milliseconds = value.toMillis();
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getTime() : null;
  }
  if (typeof value === 'string' && /(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const milliseconds = Date.parse(value);
    return Number.isFinite(milliseconds) ? milliseconds : null;
  }
  return null;
}

function isValidSemesterParity(value: unknown): value is 'ganjil' | 'genap' {
  return value === 'ganjil' || value === 'genap';
}

function parseSessionId(rawData: unknown): string {
  const data = getCallableData(rawData);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) {
    reject('invalid-argument', 'Identitas sesi tidak valid.');
  }
  return sessionId;
}

async function assertSessionMatchesClass(
  transaction: Transaction,
  session: DocumentData,
): Promise<string> {
  const classId = typeof session.classId === 'string' ? session.classId.trim() : '';
  if (!classId || classId.includes('/')) {
    reject('failed-precondition', 'Sesi tidak terhubung dengan kelas.');
  }
  const classSnapshot = await transaction.get(db.doc(`classes/${classId}`));
  if (!classSnapshot.exists) reject('failed-precondition', 'Kelas sesi tidak ditemukan.');
  const classData = classSnapshot.data();
  const semester = classData?.semester;
  const parity = classData?.semesterParity;
  if (typeof semester !== 'number'
    || !Number.isInteger(semester)
    || semester <= 0
    || !isValidSemesterParity(parity)
    || parity !== (semester % 2 === 1 ? 'ganjil' : 'genap')
    || typeof classData?.courseId !== 'string'
    || !classData.courseId
    || typeof classData?.assistantUid !== 'string'
    || !classData.assistantUid) {
    reject('failed-precondition', 'Data kelas tidak valid.');
  }
  if (classData?.courseId !== session.courseId
    || classData?.assistantUid !== session.assistantUid
    || classData?.className !== session.className
    || classData?.semester !== session.semester
    || classData?.semesterParity !== session.semesterParity) {
    reject('failed-precondition', 'Data kelas dan sesi tidak konsisten.');
  }
  const courseSnapshot = await transaction.get(db.doc(`courseCatalog/${classData.courseId}`));
  const course = courseSnapshot.data();
  if (!courseSnapshot.exists
    || course?.semester !== semester
    || course?.semesterParity !== parity) {
    reject('failed-precondition', 'Mata kuliah dan kelas tidak konsisten.');
  }
  return classId;
}

function assertSessionAttendanceWindow(
  session: DocumentData | undefined,
): asserts session is DocumentData {
  if (!session) {
    reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
  }
  if (session?.status === 'ditutup' || session?.status === 'dibatalkan') {
    reject(
      'failed-precondition',
      'Presensi tidak bisa dilakukan karena sesi praktikum telah ditutup.',
      { reasonCode: 'SESSION_CLOSED' },
    );
  }

  const failure = getSessionTimeFailure(
    timestampToMillis(session.startsAt),
    timestampToMillis(session.endsAt),
    Date.now(),
  );
  if (failure === 'SESSION_TIME_INVALID') {
    reject(
      'failed-precondition',
      'Presensi tidak bisa dilakukan karena waktu sesi praktikum tidak valid.',
      { reasonCode: 'SESSION_TIME_INVALID' },
    );
  }
  if (failure === 'SESSION_NOT_STARTED') {
    reject(
      'failed-precondition',
      'Presensi belum dapat dilakukan karena sesi praktikum belum dimulai.',
      { reasonCode: 'SESSION_NOT_STARTED' },
    );
  }
  if (failure === 'SESSION_ENDED') {
    reject(
      'failed-precondition',
      'Presensi tidak bisa dilakukan karena waktu sesi praktikum telah berakhir.',
      { reasonCode: 'SESSION_ENDED' },
    );
  }
  if (session.status !== 'dibuka') {
    reject(
      'failed-precondition',
      'Presensi tidak bisa dilakukan, karena jam di luar sesi praktikum.',
      { reasonCode: 'SESSION_NOT_OPEN' },
    );
  }
}

function hashAttendanceQrToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function parseAttendanceQrPayload(payload: unknown): string {
  if (typeof payload !== 'string' || !payload.startsWith(ATTENDANCE_QR_PREFIX)) {
    reject('invalid-argument', 'QR presensi tidak valid.');
  }
  const token = payload.slice(ATTENDANCE_QR_PREFIX.length);
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) {
    reject('invalid-argument', 'QR presensi tidak valid.');
  }
  return token;
}

async function recordAttendance(
  uid: string,
  sessionId: string,
  latitude: unknown,
  longitude: unknown,
  accuracyMeters: unknown,
  method: AttendanceMethod,
  qrToken?: string,
) {
  if (!isFiniteCoordinate(latitude, -90, 90)
    || !isFiniteCoordinate(longitude, -180, 180)) {
    reject('invalid-argument', 'Koordinat perangkat tidak valid.');
  }
  if (typeof accuracyMeters !== 'number'
    || !Number.isFinite(accuracyMeters)
    || accuracyMeters < 0
    || accuracyMeters > MAX_ACCURACY_METERS) {
    reject('failed-precondition', 'Akurasi lokasi harus 50 meter atau lebih baik.');
  }

  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const enrollmentRef = (classId: string) => db.doc(`enrollments/${classId}_${uid}`);
  const attendanceRef = db.doc(`attendances/${sessionId}_${uid}`);
  return db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists) {
      reject('permission-denied', 'Profil pengguna tidak ditemukan.');
    }
    if (profileSnapshot.data()?.role !== 'praktikan') {
      reject('permission-denied', 'Hanya akun praktikan yang dapat melakukan presensi.');
    }

    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    assertSessionAttendanceWindow(session);

    if (method === 'qr') {
      const qrSnapshot = await transaction.get(db.doc(`attendanceQrTokens/${sessionId}`));
      const qrState = qrSnapshot.data();
      if (!qrSnapshot.exists || qrState?.sessionId !== sessionId
        || qrState.tokenHash !== hashAttendanceQrToken(qrToken ?? '')) {
        reject('invalid-argument', 'QR tidak berlaku untuk sesi yang dipilih.');
      }
      if (qrState.revokedAt != null) {
        reject('failed-precondition', 'QR telah dicabut oleh asisten.');
      }
      if (!(qrState.expiresAt instanceof Timestamp)
        || qrState.expiresAt.toMillis() <= Date.now()) {
        reject('deadline-exceeded', 'QR presensi sudah kedaluwarsa. Minta asisten memperbarui QR.');
      }
    }

    const classId = await assertSessionMatchesClass(transaction, session);

    const enrollmentSnapshot = await transaction.get(enrollmentRef(classId));
    if (!enrollmentSnapshot.exists) {
      reject('failed-precondition', 'Enrollment sesi ini belum terverifikasi.');
    }
    const enrollment = enrollmentSnapshot.data();
    if (enrollment?.praktikanId !== uid
      || enrollment?.classId !== classId
      || enrollment?.courseId !== session.courseId
      || enrollment?.semester !== session.semester) {
      reject('failed-precondition', 'Enrollment sesi ini belum terverifikasi.');
    }

    const laboratoryId =
      typeof session.laboratoryId === 'string' ? session.laboratoryId.trim() : '';
    if (!laboratoryId) {
      reject('failed-precondition', 'Sesi offline tidak memiliki laboratorium yang valid.');
    }
    const laboratorySnapshot = await transaction.get(db.doc(`laboratories/${laboratoryId}`));
    if (!laboratorySnapshot.exists) {
      reject('not-found', 'Data laboratorium tidak ditemukan.', {
        reasonCode: 'LABORATORY_NOT_FOUND',
      });
    }
    const laboratory = laboratorySnapshot.data();
    const labLatitude = laboratory?.latitude;
    const labLongitude = laboratory?.longitude;
    const radiusMeters = laboratory?.radius;
    const laboratoryName = typeof laboratory?.name === 'string' ? laboratory.name.trim() : '';
    if (!isFiniteCoordinate(labLatitude, -90, 90)
      || !isFiniteCoordinate(labLongitude, -180, 180)) {
      reject('failed-precondition', 'Koordinat laboratorium tidak valid.');
    }
    if (!laboratoryName) reject('failed-precondition', 'Nama laboratorium tidak valid.');
    if (typeof radiusMeters !== 'number'
      || !Number.isFinite(radiusMeters)
      || radiusMeters < 1
      || radiusMeters > MAX_LAB_RADIUS_METERS) {
      reject('failed-precondition', 'Radius laboratorium tidak valid.');
    }

    const distanceMeters = haversineMeters(latitude, longitude, labLatitude, labLongitude);
    if (distanceMeters > radiusMeters) {
      reject(
        'failed-precondition',
        `Lokasi berada ${Math.round(distanceMeters)} meter dari laboratorium. Radius yang diperbolehkan ${Math.round(radiusMeters)} meter.`,
      );
    }

    const attendanceSnapshot = await transaction.get(attendanceRef);
    if (attendanceSnapshot.exists) {
      reject('already-exists', 'Kamu sudah melakukan presensi pada sesi ini.');
    }
    const attendedAt = Timestamp.now();
    transaction.create(attendanceRef, {
      sessionId,
      praktikanId: uid,
      praktikanName: typeof profileSnapshot.data()?.name === 'string'
        ? profileSnapshot.data()?.name
        : '',
      attendedAt,
      status: 'hadir',
      attendanceMethod: method,
      latitude,
      longitude,
      accuracyMeters,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      laboratoryId,
      laboratoryName,
      radiusMeters,
    });
    return {
      ok: true,
      distanceMeters: Math.round(distanceMeters * 10) / 10,
      radiusMeters,
    };
  });
}

export const submitAttendance = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan untuk melakukan presensi.');
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) reject('invalid-argument', 'Identitas sesi tidak valid.');
  return recordAttendance(
    request.auth.uid,
    sessionId,
    data.latitude,
    data.longitude,
    data.accuracyMeters,
    'location',
  );
});

export const validateAttendanceQr = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan untuk menggunakan QR presensi.');
  const uid = request.auth.uid;
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) reject('invalid-argument', 'Identitas sesi tidak valid.');
  const token = parseAttendanceQrPayload(data.qrPayload);
  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const qrRef = db.doc(`attendanceQrTokens/${sessionId}`);

  return db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists || profileSnapshot.data()?.role !== 'praktikan') {
      reject('permission-denied', 'Hanya akun praktikan yang dapat menggunakan QR presensi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    assertSessionAttendanceWindow(session);
    const qrSnapshot = await transaction.get(qrRef);
    const qrState = qrSnapshot.data();
    if (!qrSnapshot.exists || qrState?.sessionId !== sessionId
      || qrState.tokenHash !== hashAttendanceQrToken(token)) {
      reject('invalid-argument', 'QR tidak berlaku untuk sesi yang dipilih.');
    }
    if (qrState.revokedAt != null) {
      reject('failed-precondition', 'QR telah dicabut oleh asisten.');
    }
    if (!(qrState.expiresAt instanceof Timestamp)
      || qrState.expiresAt.toMillis() <= Date.now()) {
      reject('deadline-exceeded', 'QR presensi sudah kedaluwarsa. Minta asisten memperbarui QR.');
    }

    const classId = await assertSessionMatchesClass(transaction, session);
    const enrollmentSnapshot = await transaction.get(db.doc(`enrollments/${classId}_${uid}`));
    if (!enrollmentSnapshot.exists
      || enrollmentSnapshot.data()?.praktikanId !== uid
      || enrollmentSnapshot.data()?.classId !== classId
      || enrollmentSnapshot.data()?.courseId !== session.courseId
      || enrollmentSnapshot.data()?.semester !== session.semester) {
      reject('failed-precondition', 'Enrollment sesi ini belum terverifikasi.');
    }
    return {
      ok: true,
      sessionId,
      practicumName: typeof session.practicumName === 'string' ? session.practicumName : '',
      className: typeof session.className === 'string' ? session.className : '',
      expiresAt: qrState.expiresAt.toDate().toISOString(),
    };
  });
});

export const submitQrAttendance = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan untuk melakukan presensi.');
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) reject('invalid-argument', 'Identitas sesi tidak valid.');
  const token = parseAttendanceQrPayload(data.qrPayload);
  return recordAttendance(
    request.auth.uid,
    sessionId,
    data.latitude,
    data.longitude,
    data.accuracyMeters,
    'qr',
    token,
  );
});

export const issueAttendanceQr = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan.');
  const uid = request.auth.uid;
  const assistantSemesterParity = request.auth.token.assistantSemesterParity;
  if (!isValidSemesterParity(assistantSemesterParity)) {
    reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
  }
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) reject('invalid-argument', 'Identitas sesi tidak valid.');

  const token = randomBytes(32).toString('base64url');
  const tokenHash = hashAttendanceQrToken(token);
  const expiresAt = Timestamp.fromMillis(Date.now() + ATTENDANCE_QR_TTL_MS);
  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const qrRef = db.doc(`attendanceQrTokens/${sessionId}`);
  await db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists
      || !['asisten', 'assistant'].includes(profileSnapshot.data()?.role)) {
      reject('permission-denied', 'Hanya asisten yang dapat menerbitkan QR presensi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    if (session?.assistantUid !== uid
      || !isValidSemesterParity(session?.semesterParity)
      || session?.semesterParity !== assistantSemesterParity) {
      reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
    }
    await assertSessionMatchesClass(transaction, session);
    if (session.status !== 'dibuka') {
      reject('failed-precondition', 'QR hanya dapat diterbitkan ketika sesi dibuka.');
    }
    transaction.set(qrRef, {
      sessionId,
      tokenHash,
      issuedBy: uid,
      issuedAt: Timestamp.now(),
      expiresAt,
      revokedAt: null,
      revokedBy: null,
    });
  });

  return {
    ok: true,
    qrPayload: `${ATTENDANCE_QR_PREFIX}${token}`,
    expiresAt: expiresAt.toDate().toISOString(),
  };
});

export const revokeAttendanceQr = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan.');
  const uid = request.auth.uid;
  const assistantSemesterParity = request.auth.token.assistantSemesterParity;
  if (!isValidSemesterParity(assistantSemesterParity)) {
    reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
  }
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  if (!sessionId || sessionId.includes('/')) reject('invalid-argument', 'Identitas sesi tidak valid.');

  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const qrRef = db.doc(`attendanceQrTokens/${sessionId}`);
  return db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists
      || !['asisten', 'assistant'].includes(profileSnapshot.data()?.role)) {
      reject('permission-denied', 'Hanya asisten yang dapat mencabut QR presensi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    if (session?.assistantUid !== uid
      || !isValidSemesterParity(session?.semesterParity)
      || session?.semesterParity !== assistantSemesterParity) {
      reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
    }
    await assertSessionMatchesClass(transaction, session);
    const qrSnapshot = await transaction.get(qrRef);
    if (!qrSnapshot.exists || qrSnapshot.data()?.revokedAt != null) {
      return { ok: true, revoked: false };
    }
    transaction.update(qrRef, {
      revokedAt: FieldValue.serverTimestamp(),
      revokedBy: uid,
    });
    return { ok: true, revoked: true };
  });
});

export const openSession = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan.');
  const uid = request.auth.uid;
  const assistantSemesterParity = request.auth.token.assistantSemesterParity;
  if (!isValidSemesterParity(assistantSemesterParity)) {
    reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
  }
  const sessionId = parseSessionId(request.data);

  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  await db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists
      || !['asisten', 'assistant'].includes(profileSnapshot.data()?.role)) {
      reject('permission-denied', 'Hanya asisten yang dapat membuka sesi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data()!;
    if (session.assistantUid !== uid
      || !isValidSemesterParity(session.semesterParity)
      || session.semesterParity !== assistantSemesterParity) {
      reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
    }
    await assertSessionMatchesClass(transaction, session);

    if (session.status === 'dibuka') {
      reject('failed-precondition', 'Sesi sudah dibuka.');
    }
    if (session.status !== 'terjadwal') {
      reject('failed-precondition', 'Sesi yang sudah ditutup atau dibatalkan tidak dapat dibuka kembali.');
    }

    const startsAtMs = timestampToMillis(session.startsAt);
    const endsAtMs = timestampToMillis(session.endsAt);
    const timeFailure = getSessionTimeFailure(startsAtMs, endsAtMs, Date.now());
    if (startsAtMs === null || endsAtMs === null || timeFailure === 'SESSION_TIME_INVALID') {
      reject('failed-precondition', 'Waktu sesi praktikum tidak valid.');
    }
    if (timeFailure === 'SESSION_ENDED') {
      reject('failed-precondition', 'Sesi yang waktunya sudah berakhir tidak dapat dibuka.');
    }

    transaction.update(sessionRef, {
      status: 'dibuka',
      startsAt: Timestamp.fromMillis(startsAtMs),
      endsAt: Timestamp.fromMillis(endsAtMs),
    });
  });
  return { ok: true };
});

export const closeSession = onCall(async (request) => {
  if (!request.auth) reject('unauthenticated', 'Autentikasi diperlukan.');
  const uid = request.auth.uid;
  const assistantSemesterParity = request.auth.token.assistantSemesterParity;
  if (!isValidSemesterParity(assistantSemesterParity)) {
    reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
  }
  const sessionId = parseSessionId(request.data);

  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const qrRef = db.doc(`attendanceQrTokens/${sessionId}`);
  await db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists
      || !['asisten', 'assistant'].includes(profileSnapshot.data()?.role)) {
      reject('permission-denied', 'Hanya asisten yang dapat menutup sesi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    if (session?.assistantUid !== uid
      || !isValidSemesterParity(session?.semesterParity)
      || session.semesterParity !== assistantSemesterParity) {
      reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
    }
    await assertSessionMatchesClass(transaction, session);
    if (session.status !== 'dibuka') {
      reject('failed-precondition', 'Hanya sesi yang sedang dibuka yang dapat ditutup.');
    }

    const qrSnapshot = await transaction.get(qrRef);
    transaction.update(sessionRef, { status: 'ditutup' });
    if (qrSnapshot.exists && qrSnapshot.data()?.revokedAt == null) {
      transaction.update(qrRef, {
        revokedAt: FieldValue.serverTimestamp(),
        revokedBy: uid,
      });
    }
  });
  return { ok: true };
});

export const cancelAttendance = onCall(async (request) => {
  if (!request.auth) {
    reject('unauthenticated', 'Autentikasi diperlukan.');
  }
  const uid = request.auth.uid;
  const assistantSemesterParity = request.auth.token.assistantSemesterParity;
  if (!isValidSemesterParity(assistantSemesterParity)) {
    reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
  }
  const data = getCallableData(request.data);
  const sessionId = typeof data.sessionId === 'string' ? data.sessionId.trim() : '';
  const attendanceId = typeof data.attendanceId === 'string' ? data.attendanceId.trim() : '';
  if (!sessionId || sessionId.includes('/') || !attendanceId || attendanceId.includes('/')) {
    reject('invalid-argument', 'Data pembatalan tidak lengkap.');
  }
  if (data.reason !== undefined && data.reason !== null && typeof data.reason !== 'string') {
    reject('invalid-argument', 'Alasan pembatalan tidak valid.');
  }
  const reason = typeof data.reason === 'string' ? data.reason.trim() : '';
  if (reason.length > 300) {
    reject('invalid-argument', 'Alasan pembatalan maksimal 300 karakter.');
  }

  const profileRef = db.doc(`users/${uid}`);
  const sessionRef = db.doc(`sessions/${sessionId}`);
  const attendanceRef = db.doc(`attendances/${attendanceId}`);
  await db.runTransaction(async (transaction) => {
    const profileSnapshot = await transaction.get(profileRef);
    if (!profileSnapshot.exists || !['asisten', 'assistant'].includes(profileSnapshot.data()?.role)) {
      reject('permission-denied', 'Hanya asisten yang berwenang dapat membatalkan presensi.');
    }
    const sessionSnapshot = await transaction.get(sessionRef);
    if (!sessionSnapshot.exists) {
      reject('not-found', 'Sesi tidak ditemukan.', { reasonCode: 'SESSION_NOT_FOUND' });
    }
    const session = sessionSnapshot.data();
    if (session?.assistantUid !== uid
      || !isValidSemesterParity(session?.semesterParity)
      || session.semesterParity !== assistantSemesterParity) {
      reject('permission-denied', 'Anda tidak memiliki kewenangan terhadap sesi ini.');
    }
    await assertSessionMatchesClass(transaction, session);
    const attendanceSnapshot = await transaction.get(attendanceRef);
    if (!attendanceSnapshot.exists) {
      reject('not-found', 'Data presensi tidak ditemukan.', {
        reasonCode: 'ATTENDANCE_NOT_FOUND',
      });
    }
    const attendance = attendanceSnapshot.data();
    if (attendance?.sessionId !== sessionId) {
      reject('failed-precondition', 'Presensi tidak termasuk dalam sesi ini.');
    }
    if (attendance.status === 'dibatalkan') {
      reject('failed-precondition', 'Presensi sudah dibatalkan.');
    }
    if (attendance.status !== 'hadir') {
      reject('failed-precondition', 'Hanya presensi berhasil yang dapat dibatalkan.');
    }
    transaction.update(attendanceRef, {
      status: 'dibatalkan',
      cancelledAt: FieldValue.serverTimestamp(),
      cancelledBy: uid,
      cancelReason: reason || null,
    });
  });
  return { ok: true };
});
