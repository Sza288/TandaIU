import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from 'firebase/firestore';
import { db } from '../lib/firebase';

import {
  COLLECTIONS,
  LABORATORY_LIMITS,
  type LaboratoryDoc,
  type LaboratoryInput,
} from '../types/praktikum';

function requireNonEmpty(value: string, label: string): void {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(`${label} wajib diisi.`);
  }
}

function requireLatitude(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('Latitude harus berupa angka.');
  }
  if (value < LABORATORY_LIMITS.minLatitude || value > LABORATORY_LIMITS.maxLatitude) {
    throw new Error(
      `Latitude harus berada antara ${LABORATORY_LIMITS.minLatitude} sampai ${LABORATORY_LIMITS.maxLatitude}.`,
    );
  }
}

function requireLongitude(value: number): void {
  if (!Number.isFinite(value)) {
    throw new Error('Longitude harus berupa angka.');
  }
  if (value < LABORATORY_LIMITS.minLongitude || value > LABORATORY_LIMITS.maxLongitude) {
    throw new Error(
      `Longitude harus berada antara ${LABORATORY_LIMITS.minLongitude} sampai ${LABORATORY_LIMITS.maxLongitude}.`,
    );
  }
}

function requireRadius(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error('Radius harus berupa angka bulat dalam satuan meter.');
  }
  if (value < LABORATORY_LIMITS.minRadius || value > LABORATORY_LIMITS.maxRadius) {
    throw new Error(
      `Radius harus berada antara ${LABORATORY_LIMITS.minRadius} sampai ${LABORATORY_LIMITS.maxRadius} meter.`,
    );
  }
}

function requireLantai(value: number): void {
  if (!Number.isInteger(value)) {
    throw new Error('Lantai harus berupa angka bulat.');
  }
  if (value < LABORATORY_LIMITS.minLantai || value > LABORATORY_LIMITS.maxLantai) {
    throw new Error(
      `Lantai harus berada antara ${LABORATORY_LIMITS.minLantai} sampai ${LABORATORY_LIMITS.maxLantai}.`,
    );
  }
}

function requireIsoDate(value: string, label: string): void {
  requireNonEmpty(value, label);
  if (Number.isNaN(Date.parse(value))) {
    throw new Error(`${label} harus berupa tanggal yang valid.`);
  }
}

export function normalizeLaboratoryName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

export function validateLaboratoryInput(input: LaboratoryInput): void {
  requireNonEmpty(input.name, 'Nama laboratorium');
  requireLatitude(input.latitude);
  requireLongitude(input.longitude);
  requireRadius(input.radius);
  requireLantai(input.lantai);
  requireIsoDate(input.createdAt, 'Tanggal dibuat');
  requireIsoDate(input.updatedAt, 'Tanggal diperbarui');
}

function ensureUniqueName(
  input: LaboratoryInput,
  others: LaboratoryDoc[],
): void {
  const target = normalizeLaboratoryName(input.name);
  const duplicate = others.some(
    (laboratory) => normalizeLaboratoryName(laboratory.name) === target,
  );
  if (duplicate) {
    throw new Error('Nama laboratorium sudah dipakai.');
  }
}

type FirestoreErrorLike = {
  code?: unknown;
};

function mapFirestoreError(error: unknown): Error {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as FirestoreErrorLike).code)
      : '';

  if (code.includes('permission-denied')) {
    return new Error('Anda tidak memiliki izin untuk melakukan aksi ini');
  }
  if (code.includes('unavailable')) {
    return new Error('Koneksi bermasalah, coba lagi');
  }
  return new Error('Terjadi kesalahan saat menghubungi server. Silakan coba lagi.');
}

async function runFirestore<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    throw mapFirestoreError(error);
  }
}

export async function createLaboratory(
  input: LaboratoryInput,
): Promise<LaboratoryDoc> {
  validateLaboratoryInput(input);
  const payload: LaboratoryInput = {
    ...input,
    name: input.name.trim(),
  };

  const existing = await getAllLaboratories();
  ensureUniqueName(payload, existing);

  return runFirestore(async () => {
    const reference = await addDoc(
      collection(db, COLLECTIONS.laboratories),
      payload,
    );
    return { id: reference.id, ...payload };
  });
}

export async function updateLaboratory(
  id: string,
  input: LaboratoryInput,
): Promise<LaboratoryDoc> {
  validateLaboratoryInput(input);
  const payload: LaboratoryInput = {
    ...input,
    name: input.name.trim(),
  };

  const current = await getLaboratoryById(id);
  if (!current) {
    throw new Error('Laboratorium tidak ditemukan.');
  }
  const existing = await getAllLaboratories();
  ensureUniqueName(
    payload,
    existing.filter((laboratory) => laboratory.id !== id),
  );

  return runFirestore(async () => {
    await updateDoc(doc(db, COLLECTIONS.laboratories, id), payload);
    return { id, ...payload };
  });
}

async function getLaboratoryByIdUnsafe(id: string): Promise<LaboratoryDoc | null> {
  const snapshot = await getDoc(doc(db, COLLECTIONS.laboratories, id));
  if (!snapshot.exists()) {
    return null;
  }
  return {
    id: snapshot.id,
    ...(snapshot.data() as Omit<LaboratoryDoc, 'id'>),
  };
}

async function getAllLaboratoriesUnsafe(): Promise<LaboratoryDoc[]> {
  const snapshot = await getDocs(collection(db, COLLECTIONS.laboratories));
  return snapshot.docs
    .map((document) => ({
      id: document.id,
      ...(document.data() as Omit<LaboratoryDoc, 'id'>),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getLaboratoryById(id: string): Promise<LaboratoryDoc | null> {
  return runFirestore(async () => getLaboratoryByIdUnsafe(id));
}

export async function getAllLaboratories(): Promise<LaboratoryDoc[]> {
  return runFirestore(async () => getAllLaboratoriesUnsafe());
}

export async function deleteLaboratory(id: string): Promise<void> {
  return runFirestore(async () => {
    await deleteDoc(doc(db, COLLECTIONS.laboratories, id));
  });
}
