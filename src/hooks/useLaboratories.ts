import { collection, onSnapshot } from 'firebase/firestore';
import { useEffect, useState } from 'react';

import { db } from '../lib/firebase';
import { COLLECTIONS, type LaboratoryDoc } from '../types/praktikum';

export type UseLaboratoriesResult = {
  data: LaboratoryDoc[];
  loading: boolean;
  error: string | null;
};

function mapLoadError(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

  if (code.includes('permission-denied')) {
    return 'Anda tidak memiliki izin melihat data ini';
  }
  if (code.includes('unavailable')) {
    return 'Koneksi bermasalah';
  }
  return 'Terjadi kesalahan saat memuat data.';
}

export function useLaboratories(): UseLaboratoriesResult {
  const [data, setData] = useState<LaboratoryDoc[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, COLLECTIONS.laboratories),
      (snapshot) => {
        setData(
          snapshot.docs
            .map((document) => {
              const data = document.data() as Omit<LaboratoryDoc, 'id'>;
              return {
                ...data,
                id: document.id,
                // Dokumen lama belum punya isActive; perlakukan sebagai aktif.
                isActive: data.isActive !== false,
              };
            })
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setError(null);
        setResolved(true);
      },
      (snapshotError) => {
        setError(mapLoadError(snapshotError));
        setResolved(true);
      },
    );

    return unsubscribe;
  }, []);

  return { data, loading: !resolved, error };
}
