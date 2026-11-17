import { praktikans } from '../src/data/praktikans';
import { parseAccountTemplate } from '../src/migrations/accounts';

type LocalPraktikan = (typeof praktikans)[number];

type FileSystem = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
  writeFileSync: (
    path: string,
    data: string,
    options?: { encoding?: 'utf8'; mode?: number; flag?: string },
  ) => void;
  appendFileSync: (
    path: string,
    data: string,
    options?: { encoding?: 'utf8'; mode?: number },
  ) => void;
  renameSync: (oldPath: string, newPath: string) => void;
  mkdirSync: (path: string, options?: { recursive?: boolean; mode?: number }) => void;
  chmodSync: (path: string, mode: number) => void;
};

type PathModule = {
  resolve: (...parts: string[]) => string;
  relative: (from: string, to: string) => string;
  isAbsolute: (path: string) => boolean;
  dirname: (path: string) => string;
  basename: (path: string) => string;
};

type CryptoModule = {
  randomBytes: (size: number) => {
    toString: (encoding: 'base64url') => string;
  };
};

type NodeProcess = {
  argv: string[];
  env: Record<string, string | undefined>;
  exitCode?: number;
  cwd: () => string;
};

// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeRequire = require as (id: string) => unknown;
const fs = nodeRequire('fs') as FileSystem;
const pathModule = nodeRequire('path') as PathModule;
const cryptoModule = nodeRequire('crypto') as CryptoModule;
const processObject = process as unknown as NodeProcess;

const CONFIRMATION = 'PROVISION-31-DUMMY-PRAKTIKANS';
const DEFAULT_DOMAIN = 'tandaiu.com';
const DEFAULT_MAPPING_PATH = 'migration-accounts.json';

type Mode = 'manifest' | 'dry-run' | 'preflight' | 'execute' | 'verify';

type CliOptions = {
  mode: Mode;
  emailDomain: string;
  mappingPath: string;
  exclusionsPath?: string;
  credentialsOut?: string;
  mappingOut?: string;
  projectId?: string;
  serviceAccountPath?: string;
  confirm?: string;
  repairMissingProfiles: boolean;
  help: boolean;
};

type PlannedAccount = {
  praktikanId: string;
  name: string;
  studentCode: string;
  semester: number;
  email: string;
  role: 'praktikan';
};

type MappingEntry = {
  praktikanId: string;
  studentCode: string;
  uid: string;
};

type ExclusionAccount = {
  label: string;
  email: string;
  uid: string;
  studentCode?: string;
};

type PreflightAction = 'create' | 'skip' | 'repair-profile' | 'conflict';

type PreflightRow = {
  plan: PlannedAccount;
  action: PreflightAction;
  uid?: string;
  reason?: string;
};

type AuthUserRecord = {
  uid: string;
  email?: string | null;
  displayName?: string | null;
};

type AuthClient = {
  getUserByEmail: (email: string) => Promise<AuthUserRecord>;
  getUser: (uid: string) => Promise<AuthUserRecord>;
  createUser: (properties: {
    email: string;
    password: string;
    displayName?: string;
  }) => Promise<AuthUserRecord>;
};

type DocumentSnapshot = {
  exists: boolean;
  data: () => Record<string, unknown> | undefined;
};

type DocumentReference = {
  get: () => Promise<DocumentSnapshot>;
  create: (data: Record<string, unknown>) => Promise<unknown>;
};

type QuerySnapshot = {
  empty: boolean;
  docs: Array<{
    id: string;
    data: () => Record<string, unknown>;
  }>;
};

type CollectionReference = {
  doc: (id: string) => DocumentReference;
  where: (field: string, operator: string, value: unknown) => {
    get: () => Promise<QuerySnapshot>;
  };
};

type FirestoreClient = {
  collection: (name: string) => CollectionReference;
};

type AdminClients = {
  auth: AuthClient;
  firestore: FirestoreClient;
};

type AdminAppModule = {
  initializeApp: (options: Record<string, unknown>) => unknown;
  cert: (serviceAccount: Record<string, unknown>) => unknown;
};

type AdminAuthModule = {
  getAuth: (app: unknown) => AuthClient;
};

type AdminFirestoreModule = {
  getFirestore: (app: unknown) => FirestoreClient;
};

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function errorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return null;
  }
  return typeof (error as { code?: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;
}

function fail(message: string): never {
  throw new Error(message);
}

function normalizeDomain(value: string): string {
  const domain = value.trim().toLowerCase();
  if (
    !domain ||
    domain.startsWith('.') ||
    domain.endsWith('.') ||
    domain.includes('..') ||
    !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(domain)
  ) {
    fail(`Email domain tidak valid: "${value}".`);
  }
  return domain;
}

function buildEmail(name: string, domain: string): string {
  const normalizedName = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '')
    .replace(/\.{2,}/g, '.');

  if (!normalizedName || !normalizedName.includes('.')) {
    fail(`Nama praktikan harus memiliki nama depan dan belakang: "${name}".`);
  }

  return `${normalizedName}@${domain}`;
}

function buildPlan(emailDomain: string): PlannedAccount[] {
  if (praktikans.length !== 31) {
    fail(`Diharapkan 31 praktikan lokal, ditemukan ${praktikans.length}.`);
  }

  const domain = normalizeDomain(emailDomain);
  const ids = new Set<string>();
  const emailOwners = new Map<string, string[]>();
  const studentCodes = new Set<string>();

  const plan = praktikans.map((praktikan: LocalPraktikan) => {
    const praktikanId = stringValue(praktikan.id);
    const name = stringValue(praktikan.name);
    const studentCode = stringValue(praktikan.studentCode);
    if (!praktikanId || !name || !studentCode) {
      fail(`Data praktikan tidak lengkap: ${praktikanId || '<tanpa-id>'}.`);
    }
    if (!/^p\d+$/.test(praktikanId)) {
      fail(`ID praktikan tidak valid: "${praktikanId}".`);
    }
    if (ids.has(praktikanId)) fail(`ID praktikan duplikat: ${praktikanId}.`);
    if (studentCodes.has(studentCode)) {
      fail(`studentCode duplikat: ${studentCode}.`);
    }

    const email = buildEmail(name, domain);
    const owners = emailOwners.get(email) ?? [];
    owners.push(`${praktikanId} (${name})`);
    emailOwners.set(email, owners);
    ids.add(praktikanId);
    studentCodes.add(studentCode);

    return {
      praktikanId,
      name,
      studentCode,
      semester: praktikan.semester,
      email,
      role: 'praktikan' as const,
    };
  });

  const duplicateEmails = [...emailOwners.entries()].filter(
    ([, owners]) => owners.length > 1,
  );
  if (duplicateEmails.length > 0) {
    const details = duplicateEmails
      .map(([email, owners]) => `${email} -> ${owners.join(', ')}`)
      .join('; ');
    fail(
      `Email dummy duplikat: ${details}. Tidak ada suffix otomatis; perlu keputusan sebelum provisioning.`,
    );
  }

  return plan;
}

function readJson(path: string): unknown {
  if (!fs.existsSync(path)) {
    fail(`File tidak ditemukan: ${path}`);
  }
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8')) as unknown;
  } catch (error) {
    fail(`JSON tidak valid pada ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function loadMapping(path: string, plan: PlannedAccount[]): MappingEntry[] {
  const report = (() => {
    try {
      return parseAccountTemplate(readJson(path));
    } catch (error) {
      fail(
        `Mapping tidak valid: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  })();

  if (report.entries.length !== plan.length) {
    fail(`Mapping harus berisi 31 entri; ditemukan ${report.entries.length}.`);
  }
  if (report.invalid.length > 0) {
    fail(`Mapping memiliki ${report.invalid.length} entri invalid.`);
  }
  if (report.missingLocalIds.length > 0) {
    fail(`Mapping belum memiliki: ${report.missingLocalIds.join(', ')}.`);
  }
  if (report.unknownLocalIds.length > 0) {
    fail(`Mapping memiliki ID tidak dikenal: ${report.unknownLocalIds.join(', ')}.`);
  }
  if (report.duplicateUids.length > 0) {
    fail('Mapping memiliki UID duplikat.');
  }
  if (report.duplicateStudentCodes.length > 0) {
    fail('Mapping memiliki studentCode duplikat.');
  }

  const byId = new Map(report.entries.map((entry) => [entry.praktikanId, entry]));
  return plan.map((account) => {
    const entry = byId.get(account.praktikanId);
    if (!entry) fail(`Mapping tidak memiliki ${account.praktikanId}.`);
    if (entry.studentCode !== account.studentCode) {
      fail(
        `studentCode ${account.praktikanId} tidak cocok: mapping ${entry.studentCode}, lokal ${account.studentCode}.`,
      );
    }
    return {
      praktikanId: account.praktikanId,
      studentCode: entry.studentCode,
      uid: entry.uid,
    };
  });
}

function loadExclusions(path: string | undefined, required: boolean): ExclusionAccount[] | null {
  if (!path) {
    if (required) {
      fail('Exclusion list tiga akun testing wajib diberikan sebelum mode ini.');
    }
    return null;
  }

  const parsed = readJson(path);
  if (!isRecord(parsed) || !Array.isArray(parsed.accounts)) {
    fail('Exclusion list harus berupa object { "accounts": [...] }.');
  }
  if (parsed.accounts.length !== 3) {
    fail(`Exclusion list harus berisi tepat 3 akun; ditemukan ${parsed.accounts.length}.`);
  }

  const accounts = parsed.accounts.map((value, index) => {
    if (!isRecord(value)) fail(`Exclusion akun ke-${index + 1} bukan object.`);
    const email = stringValue(value.email);
    const uid = stringValue(value.uid);
    if (!email || !uid) {
      fail(
        `Exclusion akun ke-${index + 1} wajib memiliki email dan uid yang sudah diisi.`,
      );
    }
    return {
      label: stringValue(value.label) || `testing-${index + 1}`,
      email,
      uid,
      ...(stringValue(value.studentCode)
        ? { studentCode: stringValue(value.studentCode) }
        : {}),
    };
  });

  const emails = new Set<string>();
  const uids = new Set<string>();
  accounts.forEach((account) => {
    if (emails.has(account.email)) fail(`Email exclusion duplikat: ${account.email}.`);
    if (uids.has(account.uid)) fail(`UID exclusion duplikat: ${account.uid}.`);
    emails.add(account.email);
    uids.add(account.uid);
  });

  return accounts;
}

function assertExclusions(
  plan: PlannedAccount[],
  mappings: MappingEntry[],
  exclusions: ExclusionAccount[] | null,
  required: boolean,
): void {
  if (!exclusions) {
    if (required) fail('Exclusion list wajib tersedia.');
    return;
  }

  const emails = new Set(exclusions.map((account) => account.email.toLowerCase()));
  const uids = new Set(exclusions.map((account) => account.uid));
  plan.forEach((account) => {
    if (emails.has(account.email.toLowerCase())) {
      fail(
        `Email dummy ${account.email} bertabrakan dengan akun testing Husni (${account.praktikanId}).`,
      );
    }
  });
  mappings.forEach((mapping) => {
    if (mapping.uid && uids.has(mapping.uid)) {
      fail(
        `UID mapping ${mapping.praktikanId} sama dengan akun testing Husni; mapping tidak boleh dipakai.`,
      );
    }
  });
}

function printPlan(plan: PlannedAccount[]): void {
  console.log('ID | Nama | studentCode | Semester | Email | Role');
  plan.forEach((account) => {
    console.log(
      `${account.praktikanId} | ${account.name} | ${account.studentCode} | ${account.semester} | ${account.email} | ${account.role}`,
    );
  });
  console.log(`Total: ${plan.length} akun`);
}

function assertOutsideRepo(target: string, label: string): string {
  const resolved = pathModule.resolve(processObject.cwd(), target);
  const relative = pathModule.relative(processObject.cwd(), resolved);
  const insideRepo =
    relative === '' || (!relative.startsWith('..') && !pathModule.isAbsolute(relative));
  if (insideRepo) {
    fail(`${label} harus berada di luar folder project/repository.`);
  }
  return resolved;
}

function assertCredentialsPath(path: string): string {
  const resolved = assertOutsideRepo(path, 'File kredensial');
  if (fs.existsSync(resolved)) {
    fail(`File kredensial sudah ada dan tidak akan ditimpa: ${resolved}`);
  }
  return resolved;
}

function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function appendCredential(
  file: string,
  account: PlannedAccount,
  uid: string,
  password: string,
): void {
  fs.appendFileSync(
    file,
    [
      csvCell(account.praktikanId),
      csvCell(account.email),
      csvCell(password),
      csvCell(uid),
    ].join(',') + '\n',
    { encoding: 'utf8', mode: 0o600 },
  );
}

function newPassword(): string {
  return cryptoModule.randomBytes(18).toString('base64url');
}

async function importAdminModule(name: string): Promise<Record<string, unknown>> {
  try {
    return (await import(name)) as Record<string, unknown>;
  } catch {
    fail(
      'firebase-admin belum tersedia. Pasang dependency sesuai persetujuan, lalu ulangi mode Admin. package.json tidak diubah oleh script ini.',
    );
  }
}

async function createAdminClients(options: CliOptions): Promise<AdminClients> {
  const appModule = (await importAdminModule('firebase-admin/app')) as unknown as AdminAppModule;
  const authModule = (await importAdminModule('firebase-admin/auth')) as unknown as AdminAuthModule;
  const firestoreModule = (await importAdminModule(
    'firebase-admin/firestore',
  )) as unknown as AdminFirestoreModule;

  const serviceAccountPath =
    options.serviceAccountPath ||
    processObject.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
    processObject.env.GOOGLE_APPLICATION_CREDENTIALS;
  const projectId =
    options.projectId ||
    processObject.env.FIREBASE_PROJECT_ID ||
    processObject.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    fail('FIREBASE_PROJECT_ID atau --project-id wajib diisi untuk mode Admin.');
  }
  if (!serviceAccountPath) {
    fail(
      'FIREBASE_SERVICE_ACCOUNT_PATH atau GOOGLE_APPLICATION_CREDENTIALS wajib menunjuk file service account di luar repo.',
    );
  }

  const resolvedServiceAccountPath = assertOutsideRepo(
    serviceAccountPath,
    'File service account',
  );
  if (!fs.existsSync(resolvedServiceAccountPath)) {
    fail(`Service account tidak ditemukan: ${resolvedServiceAccountPath}`);
  }
  const serviceAccount = readJson(resolvedServiceAccountPath);
  if (!isRecord(serviceAccount)) {
    fail('File service account harus berisi object JSON.');
  }

  const app = appModule.initializeApp({
    credential: appModule.cert(serviceAccount),
    projectId,
  });
  return {
    auth: authModule.getAuth(app),
    firestore: firestoreModule.getFirestore(app),
  };
}

async function readProfile(
  firestore: FirestoreClient,
  uid: string,
): Promise<Record<string, unknown> | null> {
  const snapshot = await firestore.collection('users').doc(uid).get();
  return snapshot.exists ? snapshot.data() ?? {} : null;
}

function profileIssues(
  profile: Record<string, unknown> | null,
  account: PlannedAccount,
): string[] {
  if (!profile) return ['dokumen users tidak ditemukan'];
  const issues: string[] = [];
  if (stringValue(profile.role) !== 'praktikan') {
    issues.push(`role bukan praktikan (${stringValue(profile.role) || 'kosong'})`);
  }
  if (stringValue(profile.studentCode) !== account.studentCode) {
    issues.push(
      `studentCode tidak cocok (${stringValue(profile.studentCode) || 'kosong'} != ${account.studentCode})`,
    );
  }
  if (stringValue(profile.name) !== account.name) {
    issues.push('name tidak cocok');
  }
  if (stringValue(profile.email).toLowerCase() !== account.email.toLowerCase()) {
    issues.push('email tidak cocok');
  }
  if (stringValue(profile.authProvider) !== 'password') {
    issues.push('authProvider bukan password');
  }
  return issues;
}

async function findProfilesByStudentCode(
  firestore: FirestoreClient,
  studentCode: string,
): Promise<Array<{ id: string; data: Record<string, unknown> }>> {
  const snapshot = await firestore
    .collection('users')
    .where('studentCode', '==', studentCode)
    .get();
  return snapshot.docs.map((document) => ({
    id: document.id,
    data: document.data(),
  }));
}

async function preflight(
  clients: AdminClients,
  plan: PlannedAccount[],
  mappings: MappingEntry[],
  exclusions: ExclusionAccount[] | null,
): Promise<PreflightRow[]> {
  assertExclusions(plan, mappings, exclusions, true);
  const mappingByPraktikan = new Map(mappings.map((mapping) => [mapping.praktikanId, mapping]));
  const excludedUids = new Set(exclusions?.map((account) => account.uid) ?? []);
  const rows: PreflightRow[] = [];

  for (const account of plan) {
    const mapping = mappingByPraktikan.get(account.praktikanId);
    let user: AuthUserRecord | null = null;
    const mappingUid = mapping?.uid ?? '';

    if (mappingUid) {
      if (excludedUids.has(mappingUid)) {
        rows.push({
          plan: account,
          action: 'conflict',
          uid: mappingUid,
          reason: 'UID mapping adalah akun testing Husni.',
        });
        continue;
      }
      try {
        user = await clients.auth.getUser(mappingUid);
      } catch (error) {
        if (errorCode(error) === 'auth/user-not-found') {
          rows.push({
            plan: account,
            action: 'conflict',
            uid: mappingUid,
            reason: 'UID di mapping tidak ada di Firebase Auth.',
          });
          continue;
        }
        throw error;
      }
    } else {
      try {
        user = await clients.auth.getUserByEmail(account.email);
      } catch (error) {
        if (errorCode(error) !== 'auth/user-not-found') throw error;
      }
    }

    if (!user) {
      const profiles = await findProfilesByStudentCode(clients.firestore, account.studentCode);
      if (profiles.length > 0) {
        rows.push({
          plan: account,
          action: 'conflict',
          reason: `Dokumen users dengan studentCode ini sudah ada (${profiles
            .map((profile) => profile.id)
            .join(', ')}), tetapi Auth user tidak ditemukan.`,
        });
        continue;
      }
      rows.push({ plan: account, action: 'create' });
      continue;
    }

    if (excludedUids.has(user.uid)) {
      rows.push({
        plan: account,
        action: 'conflict',
        uid: user.uid,
        reason: 'Auth user adalah akun testing Husni.',
      });
      continue;
    }
    if (stringValue(user.email).toLowerCase() !== account.email.toLowerCase()) {
      rows.push({
        plan: account,
        action: 'conflict',
        uid: user.uid,
        reason: `Email Auth tidak cocok (${stringValue(user.email) || 'kosong'}).`,
      });
      continue;
    }

    const profile = await readProfile(clients.firestore, user.uid);
    const issues = profileIssues(profile, account);
    if (issues.length > 0) {
      rows.push({
        plan: account,
        action: profile ? 'conflict' : 'repair-profile',
        uid: user.uid,
        reason: profile
          ? issues.join('; ')
          : 'Auth user ada, dokumen users belum ada; dapat dibuat pada execute dengan --repair-missing-profiles.',
      });
      continue;
    }

    rows.push({ plan: account, action: 'skip', uid: user.uid });
  }

  return rows;
}

function printPreflight(rows: PreflightRow[]): void {
  console.log('ID | Email | Aksi | UID | Alasan');
  rows.forEach((row) => {
    console.log(
      `${row.plan.praktikanId} | ${row.plan.email} | ${row.action} | ${row.uid ?? '-'} | ${
        row.reason ?? '-'
      }`,
    );
  });
  const counts = rows.reduce<Record<PreflightAction, number>>(
    (result, row) => {
      result[row.action] += 1;
      return result;
    },
    { create: 0, skip: 0, 'repair-profile': 0, conflict: 0 },
  );
  console.log(
    `Ringkasan: create=${counts.create}, skip=${counts.skip}, repair-profile=${counts['repair-profile']}, conflict=${counts.conflict}`,
  );
}

async function execute(
  clients: AdminClients,
  plan: PlannedAccount[],
  mappings: MappingEntry[],
  exclusions: ExclusionAccount[] | null,
  options: CliOptions,
): Promise<void> {
  if (options.confirm !== CONFIRMATION) {
    fail(`execute membutuhkan --confirm=${CONFIRMATION}.`);
  }
  if (!exclusions) {
    fail('execute membutuhkan exclusion list tiga akun testing.');
  }

  const rows = await preflight(clients, plan, mappings, exclusions);
  const conflicts = rows.filter((row) => row.action === 'conflict');
  if (conflicts.length > 0) {
    printPreflight(rows);
    fail('Eksekusi dibatalkan karena ada conflict; tidak ada akun baru yang dibuat.');
  }
  const repairs = rows.filter((row) => row.action === 'repair-profile');
  if (repairs.length > 0 && !options.repairMissingProfiles) {
    printPreflight(rows);
    fail(
      'Ada Auth user tanpa profil users. Jalankan --repair-missing-profiles setelah review; tidak ada perubahan dilakukan.',
    );
  }

  const creates = rows.filter((row) => row.action === 'create');
  if (creates.length === 0 && repairs.length === 0) {
    console.log('Tidak ada akun/profil baru yang perlu dibuat. Semua sudah ada dan valid.');
    return;
  }

  let credentialsPath: string | null = null;
  if (creates.length > 0) {
    if (!options.credentialsOut) {
      fail('execute membutuhkan --credentials-out di luar repository untuk akun baru.');
    }
    credentialsPath = assertCredentialsPath(options.credentialsOut);
    fs.mkdirSync(pathModule.dirname(credentialsPath), { recursive: true, mode: 0o700 });
    fs.writeFileSync(
      credentialsPath,
      'praktikanId,email,password,uid\n',
      { encoding: 'utf8', mode: 0o600, flag: 'wx' },
    );
    try {
      fs.chmodSync(credentialsPath, 0o600);
    } catch {
      // Windows may not support POSIX modes; the file still remains outside the repo.
    }
  }

  for (const row of rows) {
    if (row.action === 'create') {
      const password = newPassword();
      let user: AuthUserRecord;
      let created = false;
      try {
        user = await clients.auth.createUser({
          email: row.plan.email,
          password,
          displayName: row.plan.name,
        });
        created = true;
      } catch (error) {
        if (errorCode(error) !== 'auth/email-already-exists') throw error;
        user = await clients.auth.getUserByEmail(row.plan.email);
      }

      if (!created) {
        const existingProfile = await readProfile(clients.firestore, user.uid);
        const issues = profileIssues(existingProfile, row.plan);
        if (issues.length > 0) {
          fail(
            `Auth user ${row.plan.email} muncul saat execute tetapi profilnya tidak cocok: ${issues.join('; ')}.`,
          );
        }
        console.log(`Sudah ada, skip: ${row.plan.praktikanId} | ${row.plan.email} | ${user.uid}`);
        continue;
      }

      if (!credentialsPath) {
        fail('File kredensial tidak tersedia; kredensial akun baru tidak dapat disimpan.');
      }

      // Simpan kredensial segera setelah Auth user dibuat agar tidak hilang jika
      // pembuatan profil gagal atau proses terhenti.
      appendCredential(credentialsPath, row.plan, user.uid, password);

      const profile = await readProfile(clients.firestore, user.uid);
      if (profile) {
        const issues = profileIssues(profile, row.plan);
        if (issues.length > 0) {
          fail(
            `Profil ${row.plan.praktikanId} sudah ada tetapi tidak cocok: ${issues.join('; ')}.`,
          );
        }
        continue;
      }

      try {
        await clients.firestore.collection('users').doc(user.uid).create({
          name: row.plan.name,
          email: row.plan.email,
          role: 'praktikan',
          authProvider: 'password',
          studentCode: row.plan.studentCode,
        });
      } catch (error) {
        if (errorCode(error) !== 'already-exists' && errorCode(error) !== '6') {
          throw error;
        }
        const existing = await readProfile(clients.firestore, user.uid);
        const issues = profileIssues(existing, row.plan);
        if (issues.length > 0) {
          fail(
            `Profil ${row.plan.praktikanId} sudah ada tetapi tidak cocok: ${issues.join('; ')}.`,
          );
        }
      }
      console.log(`Dibuat: ${row.plan.praktikanId} | ${row.plan.email} | ${user.uid}`);
      continue;
    }

    if (row.action === 'repair-profile' && options.repairMissingProfiles && row.uid) {
      try {
        await clients.firestore.collection('users').doc(row.uid).create({
          name: row.plan.name,
          email: row.plan.email,
          role: 'praktikan',
          authProvider: 'password',
          studentCode: row.plan.studentCode,
        });
      } catch (error) {
        if (errorCode(error) !== 'already-exists' && errorCode(error) !== '6') {
          throw error;
        }
        const existing = await readProfile(clients.firestore, row.uid);
        const issues = profileIssues(existing, row.plan);
        if (issues.length > 0) {
          fail(
            `Profil ${row.plan.praktikanId} sudah ada tetapi tidak cocok: ${issues.join('; ')}.`,
          );
        }
      }
      console.log(`Profil diperbaiki: ${row.plan.praktikanId} | uid ${row.uid}`);
    }
  }

  if (credentialsPath) {
    console.log(`Kredensial akun baru ditulis ke file di luar repository: ${credentialsPath}`);
  } else {
    console.log('Tidak ada akun Auth baru; file kredensial tidak dibuat.');
  }
  console.log('migration-accounts.json tidak diubah. Jalankan mode verify untuk membuat kandidat mapping.');
}

async function verify(
  clients: AdminClients,
  plan: PlannedAccount[],
  exclusions: ExclusionAccount[] | null,
  options: CliOptions,
): Promise<void> {
  if (!exclusions) {
    fail('verify membutuhkan exclusion list tiga akun testing.');
  }
  assertExclusions(plan, [], exclusions, true);
  const excludedUids = new Set(exclusions.map((account) => account.uid));
  const usedUids = new Set<string>();
  const mapping: Record<string, { studentCode: string; uid: string }> = {};
  const errors: string[] = [];

  for (const account of plan) {
    let user: AuthUserRecord;
    try {
      user = await clients.auth.getUserByEmail(account.email);
    } catch (error) {
      if (errorCode(error) === 'auth/user-not-found') {
        errors.push(`${account.praktikanId}: Auth user ${account.email} tidak ditemukan.`);
        continue;
      }
      throw error;
    }
    if (excludedUids.has(user.uid)) {
      errors.push(`${account.praktikanId}: UID ${user.uid} adalah akun testing Husni.`);
      continue;
    }
    if (usedUids.has(user.uid)) {
      errors.push(`${account.praktikanId}: UID ${user.uid} dipakai lebih dari satu akun.`);
      continue;
    }
    usedUids.add(user.uid);
    const profile = await readProfile(clients.firestore, user.uid);
    const issues = profileIssues(profile, account);
    if (issues.length > 0) {
      errors.push(`${account.praktikanId}: ${issues.join('; ')}.`);
      continue;
    }
    mapping[account.praktikanId] = {
      studentCode: account.studentCode,
      uid: user.uid,
    };
  }

  if (errors.length > 0) {
    errors.forEach((error) => console.error(`- ${error}`));
    fail('Verifikasi gagal; mapping tidak dihasilkan.');
  }

  const mappingJson = `${JSON.stringify(mapping, null, 2)}\n`;
  if (options.mappingOut) {
    const resolved = pathModule.resolve(processObject.cwd(), options.mappingOut);
    if (fs.existsSync(resolved)) {
      fail(`File mapping output sudah ada dan tidak akan ditimpa: ${resolved}`);
    }
    fs.writeFileSync(resolved, mappingJson, { encoding: 'utf8', flag: 'wx' });
    console.log(`Kandidat mapping ditulis ke ${resolved}. Tinjau sebelum menyalin ke migration-accounts.json.`);
  } else {
    console.log(mappingJson);
  }
  console.log('Verifikasi 31 akun berhasil. migration-accounts.json belum diubah otomatis.');
}

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    mode: 'manifest',
    emailDomain: processObject.env.PROVISION_EMAIL_DOMAIN || DEFAULT_DOMAIN,
    mappingPath: DEFAULT_MAPPING_PATH,
    exclusionsPath: processObject.env.PROVISION_EXCLUSIONS,
    credentialsOut: processObject.env.PROVISION_CREDENTIALS_OUT,
    projectId: processObject.env.FIREBASE_PROJECT_ID,
    serviceAccountPath:
      processObject.env.FIREBASE_SERVICE_ACCOUNT_PATH ||
      processObject.env.GOOGLE_APPLICATION_CREDENTIALS,
    repairMissingProfiles: false,
    help: false,
  };

  let modeSet = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--repair-missing-profiles') {
      options.repairMissingProfiles = true;
      continue;
    }
    if (argument === '--mode') {
      const value = argv[index + 1];
      index += 1;
      if (!value) fail('--mode membutuhkan nilai.');
      options.mode = parseMode(value);
      modeSet = true;
      continue;
    }
    if (argument.startsWith('--mode=')) {
      options.mode = parseMode(argument.slice('--mode='.length));
      modeSet = true;
      continue;
    }
    if (argument === '--email-domain') {
      options.emailDomain = requireValue(argv, ++index, '--email-domain');
      continue;
    }
    if (argument.startsWith('--email-domain=')) {
      options.emailDomain = argument.slice('--email-domain='.length);
      continue;
    }
    if (argument === '--mapping') {
      options.mappingPath = requireValue(argv, ++index, '--mapping');
      continue;
    }
    if (argument.startsWith('--mapping=')) {
      options.mappingPath = argument.slice('--mapping='.length);
      continue;
    }
    if (argument === '--exclusions') {
      options.exclusionsPath = requireValue(argv, ++index, '--exclusions');
      continue;
    }
    if (argument.startsWith('--exclusions=')) {
      options.exclusionsPath = argument.slice('--exclusions='.length);
      continue;
    }
    if (argument === '--credentials-out') {
      options.credentialsOut = requireValue(argv, ++index, '--credentials-out');
      continue;
    }
    if (argument.startsWith('--credentials-out=')) {
      options.credentialsOut = argument.slice('--credentials-out='.length);
      continue;
    }
    if (argument === '--mapping-out') {
      options.mappingOut = requireValue(argv, ++index, '--mapping-out');
      continue;
    }
    if (argument.startsWith('--mapping-out=')) {
      options.mappingOut = argument.slice('--mapping-out='.length);
      continue;
    }
    if (argument === '--project-id') {
      options.projectId = requireValue(argv, ++index, '--project-id');
      continue;
    }
    if (argument.startsWith('--project-id=')) {
      options.projectId = argument.slice('--project-id='.length);
      continue;
    }
    if (argument === '--service-account') {
      options.serviceAccountPath = requireValue(argv, ++index, '--service-account');
      continue;
    }
    if (argument.startsWith('--service-account=')) {
      options.serviceAccountPath = argument.slice('--service-account='.length);
      continue;
    }
    if (argument === '--confirm') {
      options.confirm = requireValue(argv, ++index, '--confirm');
      continue;
    }
    if (argument.startsWith('--confirm=')) {
      options.confirm = argument.slice('--confirm='.length);
      continue;
    }
    if (!modeSet && !argument.startsWith('-')) {
      options.mode = parseMode(argument);
      modeSet = true;
      continue;
    }
    fail(`Argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function requireValue(argv: string[], index: number, option: string): string {
  const value = argv[index];
  if (!value || value.startsWith('--')) {
    fail(`${option} membutuhkan nilai.`);
  }
  return value;
}

function parseMode(value: string): Mode {
  if (
    value === 'manifest' ||
    value === 'dry-run' ||
    value === 'preflight' ||
    value === 'execute' ||
    value === 'verify'
  ) {
    return value;
  }
  fail(`Mode tidak dikenal: ${value}`);
}

function printUsage(): void {
  console.log(
    [
      'Provisioning 31 akun praktikan dummy',
      '',
      'Mode:',
      '  manifest   Tampilkan 31 rencana akun lokal; tanpa Firebase.',
      '  dry-run    Validasi lokal + mapping; tanpa Firebase.',
      '  preflight  Cek Auth/users read-only; butuh firebase-admin + service account.',
      '  execute    Buat akun/profil yang belum ada; butuh --confirm dan kredensial.',
      '  verify     Verifikasi 31 akun dan hasilkan kandidat mapping.',
      '',
      'Contoh:',
      '  npx --yes tsx scripts/provision-dummy-praktikans.ts manifest',
      '  npx --yes tsx scripts/provision-dummy-praktikans.ts dry-run --mapping ./migration-accounts.json',
      '  npx --yes tsx scripts/provision-dummy-praktikans.ts preflight --exclusions ./exclusions.json',
      '  npx --yes tsx scripts/provision-dummy-praktikans.ts execute --exclusions ./exclusions.json --credentials-out D:\\\\secure\\\\credentials.csv --confirm=PROVISION-31-DUMMY-PRAKTIKANS',
      '  npx --yes tsx scripts/provision-dummy-praktikans.ts verify --exclusions ./exclusions.json --mapping-out ./migration-accounts.generated.json',
      '',
      'Environment:',
      '  PROVISION_EMAIL_DOMAIN      default tandaiu.com',
      '  PROVISION_EXCLUSIONS        path exclusion list (3 akun testing)',
      '  PROVISION_CREDENTIALS_OUT   path file kredensial di luar repo',
      '  FIREBASE_PROJECT_ID         project ID untuk Admin SDK',
      '  FIREBASE_SERVICE_ACCOUNT_PATH / GOOGLE_APPLICATION_CREDENTIALS',
      '',
      'Catatan: script tidak mengubah package.json, Firebase Rules, atau migration-accounts.json.',
      'Password tidak dicetak ke log dan hanya ditulis ke PROVISION_CREDENTIALS_OUT.',
      'Jangan jalankan execute sebelum exclusion list dan service account disiapkan.',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(processObject.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  const plan = buildPlan(options.emailDomain);

  if (options.mode === 'manifest') {
    printPlan(plan);
    if (options.exclusionsPath) {
      const exclusions = loadExclusions(options.exclusionsPath, true);
      assertExclusions(plan, [], exclusions, true);
      console.log('Exclusion list valid; 3 akun testing tidak bertabrakan dengan email dummy.');
    } else {
      console.log('Exclusion list belum diberikan; execute/preflight/verify akan menolak tanpa file ini.');
    }
    return;
  }

  if (options.mode === 'dry-run') {
    const mappings = loadMapping(options.mappingPath, plan);
    const exclusions = loadExclusions(options.exclusionsPath, false);
    assertExclusions(plan, mappings, exclusions, false);
    printPlan(plan);
    const emptyUids = mappings.filter((entry) => !entry.uid).length;
    console.log(`Mapping valid: ${mappings.length} entri; UID kosong: ${emptyUids}.`);
    console.log('Dry-run lokal selesai. Tidak ada koneksi Firebase dan tidak ada penulisan.');
    if (!exclusions) {
      console.log('Peringatan: exclusion list belum tersedia; execute tidak boleh dijalankan.');
    }
    console.log('Langkah berikutnya: preflight dengan service account sebelum execute.');
    return;
  }

  const exclusions = loadExclusions(options.exclusionsPath, true);
  const mappings = loadMapping(options.mappingPath, plan);
  assertExclusions(plan, mappings, exclusions, true);
  if (options.mode === 'execute') {
    if (options.confirm !== CONFIRMATION) {
      fail(`execute membutuhkan --confirm=${CONFIRMATION}.`);
    }
  }
  const clients = await createAdminClients(options);

  if (options.mode === 'preflight') {
    const rows = await preflight(clients, plan, mappings, exclusions);
    printPreflight(rows);
    if (rows.some((row) => row.action === 'conflict')) {
      fail('Preflight menemukan conflict; perbaiki sebelum execute.');
    }
    return;
  }

  if (options.mode === 'execute') {
    await execute(clients, plan, mappings, exclusions, options);
    return;
  }

  await verify(clients, plan, exclusions, options);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Provisioning gagal: ${message}`);
  processObject.exitCode = 1;
});
