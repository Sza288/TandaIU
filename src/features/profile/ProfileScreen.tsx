import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomNav from '../../components/BottomNav';
import { assistantIdentity } from '../../data/assistantIdentity';
import AssistantIllustration from '../role/illustrations/AssistantIllustration';
import PraktikanIllustration from '../role/illustrations/PraktikanIllustration';
import { useAttendance } from '../../state/AttendanceContext';
import { colors, fonts, radius, shadows, spacing } from '../../theme';
import { getPraktikanById } from '../../utils/academic';

export default function ProfileScreen() {
  const { activeRole, activePraktikanId } = useAttendance();
  const praktikan = getPraktikanById(activePraktikanId);
  const isAssistant = activeRole === 'assistant';
  const name = isAssistant ? assistantIdentity.name : praktikan?.name ?? 'Pilih identitas';
  const code = isAssistant ? assistantIdentity.studentCode : praktikan?.studentCode ?? 'Belum tersedia';
  const role = isAssistant
    ? assistantIdentity.role
    : activeRole === 'praktikan'
      ? 'Praktikan'
      : 'Belum memilih peran';
  const openRoleSelection = () => router.push('/role');

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>AKUN</Text>
        <Text style={styles.headerTitle}>Profil</Text>
      </View>
      <View style={styles.content}>
        <View style={styles.identityCard}>
          <View style={styles.avatar}>
            {isAssistant ? (
              <AssistantIllustration size={96} />
            ) : (
              <PraktikanIllustration size={96} />
            )}
          </View>
          <Text style={styles.sectionTitle}>Informasi Identitas</Text>
          <View style={styles.identityDetails}>
            <ProfileRow icon="person-outline" label="Nama" value={name} />
            <ProfileRow
              icon="card-outline"
              label={isAssistant ? 'NIM Asisten' : 'NIM Praktikan'}
              value={code}
            />
            <ProfileRow icon="school-outline" label="Program Studi" value="S1-Informatika" />
            {!isAssistant && praktikan ? (
              <ProfileRow icon="library-outline" label="Semester" value={`${praktikan.semester}`} />
            ) : null}
            <ProfileRow icon="ribbon-outline" label="Peran" value={role} />
          </View>
        </View>

        <TouchableOpacity
          style={styles.switchButton}
          onPress={openRoleSelection}
          activeOpacity={0.8}
          accessibilityRole="button"
        >
          <Ionicons name="swap-horizontal-outline" size={20} color={colors.primaryDark} />
          <Text style={styles.switchText}>
            {isAssistant ? 'Ganti Peran' : praktikan ? 'Ganti Identitas / Peran' : 'Pilih Peran'}
          </Text>
          <Ionicons name="chevron-forward" size={18} color={colors.primaryDark} />
        </TouchableOpacity>
      </View>
      <Text style={styles.brand}>TandaIU</Text>
      <BottomNav />
    </SafeAreaView>
  );
}

function ProfileRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <View style={styles.detailIcon}>
        <Ionicons name={icon} size={18} color={colors.primaryDark} />
      </View>
      <View style={styles.detailCopy}>
        <Text style={styles.detailLabel}>{label}</Text>
        <Text style={styles.detailValue}>{value}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  eyebrow: {
    color: colors.primary,
    fontFamily: fonts.bold,
    fontSize: 10,
    letterSpacing: 1.2,
  },
  headerTitle: {
    marginTop: spacing.xs,
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 24,
  },
  content: {
    flex: 1,
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  identityCard: {
    alignItems: 'stretch',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    ...shadows.card,
  },
  avatar: {
    width: 112,
    height: 112,
    alignSelf: 'center',
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    overflow: 'hidden',
  },
  identityDetails: {
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    paddingVertical: 2,
  },
  detailIcon: {
    width: 20,
    height: 20,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySofter,
  },
  detailCopy: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
  detailValue: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    lineHeight: 16,
    flexWrap: 'wrap',
  },
  switchButton: {
    minHeight: 50,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  switchText: {
    flex: 1,
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  brand: {
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
    color: colors.primaryDark,
    fontFamily: fonts.brand,
    fontSize: 20,
    textAlign: 'center',
  },
});
