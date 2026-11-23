import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { doc, getDoc, getFirestore } from 'firebase/firestore';

import { runMigrations } from './index';
import { parseAccountTemplate } from './accounts';
import {
  buildPreflightReport,
  type PreflightReport,
} from './preflight';
import type {
  MigrationRunResult,
  RelationCheck,
} from './types';

type FileSystem = {
  existsSync: (path: string) => boolean;
  readFileSync: (path: string, encoding: 'utf8') => string;
};

// Node entry point. The file is not imported by the Expo app, so this module
// can use Node's filesystem without pulling React Native into the build.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFs = require('fs') as FileSystem;

type CliOptions = {
  accountsPath?: string;
  dryRun: boolean;
  localOnly: boolean;
  json: boolean;
  verbose: boolean;
  help: boolean;
  schedules: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: false,
    localOnly: false,
    json: false,
    verbose: false,
    help: false,
    schedules: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    if (argument === '--local-only') {
      options.localOnly = true;
      continue;
    }
    if (argument === '--json') {
      options.json = true;
      continue;
    }
    if (argument === '--verbose') {
      options.verbose = true;
      continue;
    }
    if (argument === '--schedules') {
      options.schedules = true;
      continue;
    }
    if (argument === '--help' || argument === '-h') {
      options.help = true;
      continue;
    }
    if (argument === '--accounts') {
      options.accountsPath = argv[index + 1];
      index += 1;
      continue;
    }
    if (argument.startsWith('--accounts=')) {
      options.accountsPath = argument.slice('--accounts='.length);
      continue;
    }
    throw new Error(`Argumen tidak dikenal: ${argument}`);
  }

  return options;
}

function loadDotEnv(): void {
  const path = '.env';
  if (!nodeFs.existsSync(path)) return;

  nodeFs
    .readFileSync(path, 'utf8')
    .split(/\r?\n/)
    .forEach((rawLine: string) => {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) return;

      const separator = line.indexOf('=');
      if (separator <= 0) return;

      const key = line.slice(0, separator).trim();
      let value = line.slice(separator + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
}

function readAccountsJson(path: string): unknown {
  if (!nodeFs.existsSync(path)) {
    throw new Error(`File mapping tidak ditemukan: ${path}`);
  }

  return JSON.parse(nodeFs.readFileSync(path, 'utf8')) as unknown;
}

function summarizeRelation(relation: RelationCheck, verbose: boolean): string {
  const parts = [`${relation.valid}/${relation.checked} valid`];
  if (relation.broken.length > 0) {
    const shown = verbose ? relation.broken : relation.broken.slice(0, 5);
    parts.push(`rusak: ${shown.join(', ')}`);
    if (!verbose && relation.broken.length > shown.length) {
      parts.push(`(+${relation.broken.length - shown.length} lagi)`);
    }
  }
  if (relation.error) parts.push(relation.error);
  if (relation.note) parts.push(relation.note);
  return parts.join(' | ');
}

function printReport(result: MigrationRunResult, options: CliOptions): void {
  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  console.log('\n=== Langkah migrasi ===');
  if (result.dryRun) {
    console.log('Mode: DRY-RUN (tidak ada penulisan)');
  }
  result.steps.forEach((step) => {
    console.log(`[${step.status}] ${step.title}: ${step.summary}`);
    if (options.verbose) {
      step.details.forEach((detail) => console.log(`  - ${detail}`));
    }
  });

  console.log('\n=== Jumlah collection ===');
  const before = new Map(result.countsBefore.map((count) => [count.name, count]));
  result.countsAfter.forEach((count) => {
    const previous = before.get(count.name);
    const beforeText = previous ? String(previous.count ?? 'n/a') : '?';
    const afterText = count.count ?? 'n/a';
    console.log(
      `- ${count.name}: ${beforeText} -> ${afterText}${count.error ? ` (${count.error})` : ''}`,
    );
  });

  console.log('\n=== Relasi ===');
  result.verification.collections.forEach((collection) => {
    console.log(
      `- ${collection.name}: ${collection.count ?? 'n/a'} dokumen${
        collection.error ? ` (${collection.error})` : ''
      }`,
    );
    if (collection.note) console.log(`  catatan: ${collection.note}`);
    collection.relations.forEach((relation) => {
      console.log(`  ${relation.name}: ${summarizeRelation(relation, options.verbose)}`);
    });
  });

  console.log('\n=== Enrollment ===');
  console.log(
    `- Mapping UID: ${result.enrollmentAccounts.mapped}/${result.enrollmentAccounts.accounts}`,
  );
  console.log(
    `- Target: ${result.enrollmentPlan.expectedCount}; siap ditulis: ${result.enrollmentPlan.items.length}; tanpa UID: ${result.enrollmentPlan.missingStudentCodes.length}`,
  );
  if (result.enrollmentAccounts.duplicateStudentCodes.length > 0) {
    console.log(
      `- Kode mahasiswa duplikat: ${result.enrollmentAccounts.duplicateStudentCodes.length}`,
    );
  }
  if (result.enrollmentAccounts.duplicateUids.length > 0) {
    console.log(`- UID duplikat: ${result.enrollmentAccounts.duplicateUids.length}`);
  }
  if (result.enrollmentAccounts.ignored.length > 0) {
    console.log(`- Mapping diabaikan: ${result.enrollmentAccounts.ignored.length}`);
  }
  if (result.enrollmentWrite) {
    console.log(
      `- Hasil tulis: dibuat ${result.enrollmentWrite.created}, sudah ada ${result.enrollmentWrite.skippedExisting}, gagal ${result.enrollmentWrite.failed}, tidak dicoba ${result.enrollmentWrite.notAttempted}`,
    );
    if (result.enrollmentWrite.blockedReason) {
      console.log(`- Dihentikan: ${result.enrollmentWrite.blockedReason}`);
    }
    if (options.verbose && result.enrollmentWrite.createdIds.length > 0) {
      console.log(`- ID dibuat: ${result.enrollmentWrite.createdIds.join(', ')}`);
    }
  } else {
    console.log('- Tidak ada penulisan enrollment pada eksekusi ini.');
  }
}

function printPreflightReport(report: PreflightReport, options: CliOptions): void {
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return;
  }

  console.log('\n=== Preflight lokal (tanpa Firestore) ===');
  console.log(`- Seed sessions: ${report.seed.sessions.length}`);
  console.log(`- Pasangan courseId + className unik: ${report.seed.classes.length}`);
  console.log(`- Duplikasi session ID: ${report.seed.duplicateSessionIds.length}`);
  console.log(`- Duplikasi pasangan kelas: ${report.seed.duplicateClassPairs.length}`);
  console.log(`- courseId tidak dikenal: ${report.seed.invalidCourseIds.length}`);
  console.log(`- className kosong: ${report.seed.missingClassNames.length}`);
  console.log(
    `- Mapping template: ${report.accountFormat ?? 'belum ada'}; entri ${report.accountEntries}; invalid ${report.accountInvalid}`,
  );
  console.log(`- UID terpetakan: ${report.mappedUids}; UID belum diisi: ${report.missingUids}`);
  console.log(
    `- Enrollment target: ${report.expectedEnrollments}; siap ditulis: ${report.readyEnrollments}`,
  );

  console.log('\n=== Pemetaan session -> classId ===');
  report.seed.sessions.forEach((session) => {
    console.log(
      `- ${session.sessionId}: ${session.courseId || '<kosong>'} / ${
        session.className || '<kosong>'
      } -> ${session.expectedClassId || '<tidak valid>'} (semester ${
        session.semester ?? '?'
      })`,
    );
  });

  console.log('\n=== Target enrollment per kelas ===');
  console.log(`- Total target: ${report.targetTotal}`);
  report.targets.forEach((target) => {
    console.log(
      `- ${target.classId} | ${target.courseId} | semester ${
        target.semester ?? '?'
      } | ${target.praktikanCount} praktikan`,
    );
  });

  if (report.targetIssues.length > 0) {
    console.log('\n=== Masalah relasi target ===');
    report.targetIssues.forEach((issue) => console.log(`- ${issue}`));
  }

  if (report.seed.duplicateClassPairs.length > 0) {
    console.log('\n=== Pasangan kelas duplikat ===');
    report.seed.duplicateClassPairs.forEach((pair) => {
      console.log(
        `- ${pair.courseId} / ${pair.className}: sesi ${pair.sessionIds.join(', ')}`,
      );
    });
  }

  if (report.accountIssues.length > 0) {
    console.log('\n=== Entri mapping bermasalah ===');
    report.accountIssues.forEach((issue) => {
      console.log(
        `- ${issue.praktikanId ?? '?'} | ${issue.studentCode ?? '?'} | ${issue.reason}`,
      );
    });
  }

  if (report.duplicateUids.length > 0) {
    console.log('\n=== UID duplikat ===');
    report.duplicateUids.forEach((duplicate) => {
      console.log(`- ${duplicate.value}: ${duplicate.praktikanIds.join(', ')}`);
    });
  }

  if (report.duplicateStudentCodes.length > 0) {
    console.log('\n=== studentCode duplikat ===');
    report.duplicateStudentCodes.forEach((duplicate) => {
      console.log(`- ${duplicate.value}: ${duplicate.praktikanIds.join(', ')}`);
    });
  }

  if (report.missingLocalIds.length > 0) {
    console.log(
      `\nPraktikan lokal yang belum ada di template: ${report.missingLocalIds.join(', ')}`,
    );
  }

  console.log('\n=== Mapping yang masih dibutuhkan ===');
  const missingMappings = report.requiredMappings.filter((mapping) => !mapping.uid);
  if (missingMappings.length === 0) {
    console.log('- Tidak ada; semua UID sudah terisi.');
  } else {
    missingMappings.forEach((mapping) => {
      console.log(
        `- ${mapping.praktikanId} | ${mapping.studentCode} | ${mapping.praktikanName} | uid: <belum diisi>`,
      );
    });
  }

  console.log('\n=== Blocker ===');
  report.blockers.forEach((blocker) => console.log(`- ${blocker}`));

  if (options.verbose) {
    console.log('\n=== Catatan ===');
    report.notes.forEach((note) => console.log(`- ${note}`));
  }
}

function printUsage(): void {
  console.log(
    [
      'Migrasi TandaIU',
      '',
      'Jalankan dari root repo:',
      '  npx --yes tsx src/migrations/run.ts [opsi]',
      '',
      'Opsi:',
      '  --accounts <file>  JSON mapping studentCode -> UID praktikan',
      '  --schedules        Buat jadwal dari sesi lama lalu tautkan scheduleId',
      '  --local-only       Validasi seed/template lokal tanpa Firebase',
      '  --dry-run          Baca dan rencanakan tanpa menulis apa pun',
      '  --json             Cetak laporan JSON lengkap',
      '  --verbose          Tampilkan detail langkah dan ID',
      '  --help             Tampilkan bantuan',
      '',
      'Environment (hanya untuk mode Firestore):',
      '  MIGRATION_EMAIL     Email akun asisten Firebase Auth',
      '  MIGRATION_PASSWORD  Kata sandi akun asisten',
      '',
      'Contoh file mapping (format template):',
      '  {',
      '    "p1": { "studentCode": "24060124120001", "uid": "" }',
      '  }',
      'Format array atau { "accounts": [...] } juga diterima.',
      '',
      'Catatan: collection enrollments belum memiliki match di firestore.rules.',
      'Penulisan akan dilaporkan blocked sampai pemilik rules menambahkannya.',
    ].join('\n'),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printUsage();
    return;
  }

  if (options.localOnly) {
    const parsed = options.accountsPath
      ? readAccountsJson(options.accountsPath)
      : null;
    const accountReport = parsed ? parseAccountTemplate(parsed) : null;
    printPreflightReport(buildPreflightReport(accountReport), options);
    return;
  }

  loadDotEnv();

  const firebaseConfig = {
    apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  };

  if (
    !firebaseConfig.apiKey ||
    !firebaseConfig.projectId ||
    !firebaseConfig.appId
  ) {
    throw new Error(
      'Konfigurasi Firebase belum lengkap. Isi EXPO_PUBLIC_FIREBASE_* pada .env.',
    );
  }

  const email = process.env.MIGRATION_EMAIL;
  const password = process.env.MIGRATION_PASSWORD;
  if (!email || !password) {
    printUsage();
    throw new Error(
      'MIGRATION_EMAIL dan MIGRATION_PASSWORD wajib diisi untuk akun asisten.',
    );
  }

  const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const database = getFirestore(app);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    const profile = await getDoc(doc(database, 'users', credential.user.uid));
    const role = profile.exists() ? profile.data().role : null;
    const token = await credential.user.getIdTokenResult();
    const claimParity = token.claims.assistantSemesterParity;
    const semesterParity = claimParity === 'ganjil' || claimParity === 'genap'
      ? claimParity
      : null;
    const assistantUid = credential.user.uid;

    if (options.schedules && !semesterParity) {
      throw new Error(
        'Custom claim assistantSemesterParity wajib bernilai ganjil/genap untuk --schedules.',
      );
    }

    if (role !== 'asisten') {
      if (!options.dryRun) {
        throw new Error(
          "Akun operator harus memiliki users/{uid}.role = 'asisten'. Gunakan --dry-run untuk inspeksi tanpa menulis.",
        );
      }
      console.warn(
        `Peringatan: role akun "${String(role)}" bukan asisten; dry-run tetap dijalankan.`,
      );
    }

    const accountReport = options.accountsPath
      ? parseAccountTemplate(readAccountsJson(options.accountsPath))
      : null;
    const enrollmentAccounts = accountReport?.accounts ?? [];

    if (accountReport) {
      if (accountReport.invalid.length > 0) {
        console.warn(
          `${accountReport.invalid.length} entri mapping tidak valid dan diabaikan. Jalankan --local-only --verbose untuk detail.`,
        );
      }
      if (accountReport.missingUids.length > 0) {
        console.warn(
          `${accountReport.missingUids.length} UID praktikan masih kosong; enrollment terkait tidak akan dibuat.`,
        );
      }
      if (accountReport.missingLocalIds.length > 0) {
        console.warn(
          `${accountReport.missingLocalIds.length} praktikan lokal belum ada di template: ${accountReport.missingLocalIds.join(', ')}.`,
        );
      }
    }

    console.log(
      `Masuk sebagai ${credential.user.email ?? credential.user.uid}; ${enrollmentAccounts.length} mapping akun dimuat.`,
    );

    const result = await runMigrations({
      database,
      enrollmentAccounts,
      dryRun: options.dryRun,
      ...(options.schedules && semesterParity
        ? { injectSchedules: { assistantUid, semesterParity } }
        : {}),
    });

    printReport(result, options);
  } finally {
    await signOut(auth).catch(() => undefined);
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Migrasi gagal: ${message}`);
  process.exitCode = 1;
});
