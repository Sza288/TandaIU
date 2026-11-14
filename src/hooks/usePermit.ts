import { useSyncExternalStore } from 'react';
import { Permit } from '../features/permit/permit.types';
import { getPermits, subscribePermits } from '../services/permitService';

/**
 * Berlangganan seluruh pengajuan izin. Setiap perubahan dari
 * `permitService` langsung memicu render ulang (status realtime).
 */
export function usePermits(): Permit[] {
  return useSyncExternalStore(subscribePermits, getPermits, getPermits);
}

/** Memantau satu pengajuan izin berdasarkan id. */
export function usePermit(permitId: string | null): Permit | undefined {
  const permits = usePermits();
  if (!permitId) return undefined;
  return permits.find((permit) => permit.id === permitId);
}
