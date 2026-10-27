export const fonts = {
  brand: 'Comfortaa_700Bold',
  heading: 'NunitoSans_800ExtraBold',
  bold: 'NunitoSans_700Bold',
  semiBold: 'NunitoSans_600SemiBold',
  regular: 'NunitoSans_400Regular',
} as const;

export const colors = {
  background: '#FFF6F8',
  backgroundAlt: '#FFF1F5',
  surface: '#FFFFFF',
  surfaceMuted: '#FFF9FB',
  border: '#FADCE7',
  borderStrong: '#F5C6D8',

  primary: '#E8407A',
  primaryDark: '#B0245A',
  primaryDeep: '#9C2B57',
  primarySoft: '#FFE3EC',
  primarySofter: '#FDEDF3',

  text: '#1F2430',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  success: '#0E9F6E',
  successBg: '#DCFCE7',
  danger: '#DC2626',
  dangerBg: '#FEE2E2',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  neutral: '#6B7280',
  neutralBg: '#F3F4F6',
  neutralBorder: '#D1D5DB',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const typography = {
  eyebrow: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 26,
    fontWeight: '800' as const,
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '800' as const,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700' as const,
  },
  body: {
    fontSize: 14,
    fontWeight: '400' as const,
  },
  label: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: '#B0245A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 1,
  },
  floating: {
    shadowColor: '#B0245A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 8,
    elevation: 4,
  },
} as const;

export const statusStyles = {
  terjadwal: {
    label: 'Terjadwal',
    backgroundColor: colors.primarySofter,
    textColor: colors.primaryDark,
    borderColor: colors.primarySoft,
  },
  dibuka: {
    label: 'Dibuka',
    backgroundColor: '#F7B7CE',
    textColor: '#8C1246',
    borderColor: '#F7B7CE',
  },
  ditutup: {
    label: 'Ditutup',
    backgroundColor: colors.surface,
    textColor: colors.neutral,
    borderColor: colors.neutralBorder,
  },
} as const;
