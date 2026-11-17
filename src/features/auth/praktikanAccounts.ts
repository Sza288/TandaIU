import { praktikans } from '../../data/praktikans';
import type { Semester } from '../../types';

/**
 * Domain email akun praktikan demo. Sama dengan default
 * `PROVISION_EMAIL_DOMAIN` pada scripts/provision-dummy-praktikans.ts,
 * sehingga email di daftar ini cocok dengan akun Firebase Auth yang sudah ada.
 */
const PRACTIKAN_EMAIL_DOMAIN = 'tandaiu.com';

export type PraktikanAccount = {
  id: string;
  name: string;
  email: string;
  semester?: Semester;
  /** Keterangan pengganti semester untuk akun non-praktikan. */
  note?: string;
};

/**
 * Menyamakan aturan normalisasi nama dengan script provisioning agar email
 * yang dihasilkan identik dengan akun Auth yang sudah terdaftar.
 */
function buildPraktikanEmail(name: string): string {
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  return `${normalizedName}@${PRACTIKAN_EMAIL_DOMAIN}`;
}

const praktikanEntries: PraktikanAccount[] = praktikans.map((praktikan) => ({
  id: praktikan.id,
  name: praktikan.name,
  email: buildPraktikanEmail(praktikan.name),
  semester: praktikan.semester,
}));

/**
 * Akun uji yang terdaftar di Firebase Auth tetapi tidak berasal dari
 * `src/data/praktikans.ts` (akun testing yang sengaja dikecualikan dari
 * provisioning dummy). Ditambahkan ke daftar agar bisa dipilih dari login.
 */
const ASSISTANT_ACCOUNT: PraktikanAccount = {
  id: 'account-asprak1',
  name: 'Asprak 1',
  email: 'asprak1@tandaiu.com',
  note: 'Asisten',
};

const TRAILING_ACCOUNTS: PraktikanAccount[] = [
  {
    id: 'account-praktikan1',
    name: 'praktikan1',
    email: 'praktikan1@tandaiu.com',
    note: 'Akun uji praktikan',
  },
  {
    id: 'account-husni',
    name: 'Husni Ulyaa Khanifah',
    email: 'husniulyaa11@gmail.com',
    note: 'Akun uji',
  },
  {
    id: 'account-example',
    name: 'Akun Example',
    email: 'test@example.com',
    note: 'Akun uji',
  },
];

function dedupeByEmail(accounts: PraktikanAccount[]): PraktikanAccount[] {
  const seen = new Set<string>();
  const result: PraktikanAccount[] = [];
  accounts.forEach((account) => {
    const key = account.email.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    result.push(account);
  });
  return result;
}

/**
 * Urutan tampilan daftar akun pada halaman login:
 * 1. Asprak 1 paling atas.
 * 2. Praktikan lain di tengah dengan urutan tetap dari `praktikans.ts`.
 * 3. praktikan1, Husni, dan akun example di paling bawah.
 */
export const praktikanAccounts: PraktikanAccount[] = dedupeByEmail([
  ASSISTANT_ACCOUNT,
  ...praktikanEntries,
  ...TRAILING_ACCOUNTS,
]);
