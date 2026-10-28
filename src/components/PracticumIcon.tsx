import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';

type IconName = keyof typeof Ionicons.glyphMap;

const courseIcons: [string, IconName][] = [
  ['pemrograman berorientasi objek', 'code-slash'],
  ['pemrograman berbasis objek', 'code-slash'],
  ['basis data', 'server'],
  ['jaringan komputer', 'git-network'],
  ['sistem operasi', 'settings'],
  ['struktur data', 'git-branch'],
  ['manajemen basis data', 'server'],
  ['pemrograman web', 'globe-outline'],
  ['algoritma dan pemrograman', 'code-working'],
  ['rekayasa perangkat lunak', 'construct-outline'],
  ['kecerdasan buatan', 'hardware-chip'],
  ['pembelajaran mesin', 'hardware-chip'],
  ['grafik dan teknik interaktif', 'color-palette'],
  ['analisis dan strategi algoritma', 'git-branch'],
  ['pengembangan platform khusus', 'hardware-chip'],
  ['dasar pemrograman', 'code-slash'],
  ['dasar sistem', 'settings'],
  ['grafika komputer', 'color-palette'],
  ['keamanan informasi', 'shield-checkmark'],
  ['interaksi manusia komputer', 'people'],
];

export function getPracticumIcon(practicumName: string): IconName {
  const normalizedName = practicumName.toLocaleLowerCase('id-ID');
  return courseIcons.find(([courseName]) => normalizedName.includes(courseName))?.[1]
    ?? 'school-outline';
}

type Props = {
  practicumName: string;
  size?: number;
  color?: string;
};

export default function PracticumIcon({
  practicumName,
  size = 22,
  color = colors.primary,
}: Props) {
  return <Ionicons name={getPracticumIcon(practicumName)} size={size} color={color} />;
}
