import { useEffect, useState } from 'react';
import { Permit } from '../features/permit/permit.types';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import { subscribePermits } from '../services/permitService';

type PermitSnapshot = {
  key: string | null;
  permits: Permit[];
};

/**
 * Berlangganan izin secara realtime. Asisten menerima seluruh izin,
 * praktikan hanya menerima izin miliknya sendiri (sesuai security rules).
 */
export function usePermits(): Permit[] {
  const session = useAuthSession();
  const profile = session?.status === 'authenticated' ? session.profile : null;
  const uid = profile?.uid ?? null;
  const role = profile?.role ?? null;
  const key = uid && role ? `${role}:${uid}` : null;
  const [snapshot, setSnapshot] = useState<PermitSnapshot>({ key: null, permits: [] });

  useEffect(() => {
    if (!key || !uid || !role) return;

    const scope = role === 'asisten' ? {} : { studentId: uid };
    return subscribePermits(
      scope,
      (next) => setSnapshot({ key, permits: next }),
      (message) => {
        console.warn('[permit] Gagal memuat izin:', message);
        setSnapshot({ key, permits: [] });
      },
    );
  }, [key, role, uid]);

  return snapshot.key === key ? snapshot.permits : [];
}

/** Memantau satu pengajuan izin berdasarkan id. */
export function usePermit(permitId: string | null): Permit | undefined {
  const permits = usePermits();
  if (!permitId) return undefined;
  return permits.find((permit) => permit.id === permitId);
}
