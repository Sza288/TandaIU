import { Ionicons } from '@expo/vector-icons';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ACTIVE_ACADEMIC_TERM_LABEL } from '../config/academicTerm';
import { colors, fonts, radius, spacing } from '../theme';
import { Praktikan } from '../types';
import { getInitials } from '../utils/format';

type Props = {
  visible: boolean;
  praktikans: Praktikan[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function PraktikanIdentityModal({
  visible,
  praktikans,
  selectedId,
  onSelect,
  onCancel,
  onConfirm,
}: Props) {
  const insets = useSafeAreaInsets();
  const hasSelection =
    selectedId !== null && praktikans.some((praktikan) => praktikan.id === selectedId);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, spacing.xxl) },
          ]}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>Pilih Identitas Praktikan</Text>
          <Text style={styles.subtitle}>
            Identitas demo semester {ACTIVE_ACADEMIC_TERM_LABEL.toLowerCase()}. Pilih satu
            untuk melanjutkan.
          </Text>

          {praktikans.length === 0 ? (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="person-outline" size={22} color={colors.primary} />
              </View>
              <Text style={styles.emptyTitle}>Belum ada identitas Praktikan</Text>
              <Text style={styles.emptyText}>
                Tidak ada identitas yang sesuai dengan semester akademik aktif.
              </Text>
            </View>
          ) : (
            <ScrollView
              style={styles.list}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
            >
              {praktikans.map((praktikan) => {
                const isSelected = praktikan.id === selectedId;
                const code = praktikan.studentCode ?? 'Belum tersedia';
                return (
                  <Pressable
                    key={praktikan.id}
                    onPress={() => onSelect(praktikan.id)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: isSelected }}
                    accessibilityLabel={`${praktikan.name}, NIM ${code}, Semester ${praktikan.semester}`}
                    style={({ pressed }) => [
                      styles.option,
                      isSelected && styles.optionSelected,
                      pressed && styles.optionPressed,
                    ]}
                  >
                    <View
                      style={[
                        styles.avatar,
                        isSelected && styles.avatarSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.avatarText,
                          isSelected && styles.avatarTextSelected,
                        ]}
                      >
                        {getInitials(praktikan.name)}
                      </Text>
                    </View>

                    <View style={styles.optionText}>
                      <View style={styles.titleRow}>
                        <Text style={styles.name} numberOfLines={1}>
                          {praktikan.name}
                        </Text>
                        <View
                          style={[
                            styles.semesterBadge,
                            isSelected && styles.semesterBadgeSelected,
                          ]}
                        >
                          <Text
                            style={[
                              styles.semesterText,
                              isSelected && styles.semesterTextSelected,
                            ]}
                          >
                            Semester {praktikan.semester}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.code} numberOfLines={1}>
                        NIM {code}
                      </Text>
                    </View>

                    <View
                      style={[styles.radio, isSelected && styles.radioSelected]}
                    >
                      {isSelected ? <View style={styles.radioDot} /> : null}
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              accessibilityRole="button"
              accessibilityLabel="Batalkan pemilihan identitas"
              style={({ pressed }) => [
                styles.button,
                styles.cancelButton,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.cancelText}>Batal</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={!hasSelection}
              accessibilityRole="button"
              accessibilityLabel="Lanjut dengan identitas terpilih"
              accessibilityState={{ disabled: !hasSelection }}
              style={({ pressed }) => [
                styles.button,
                styles.confirmButton,
                !hasSelection && styles.confirmButtonDisabled,
                pressed && styles.buttonPressed,
              ]}
            >
              <Text style={styles.confirmText}>Lanjut</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(60, 15, 35, 0.42)',
    justifyContent: 'flex-end',
  },
  sheet: {
    maxHeight: '88%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.borderStrong,
    alignSelf: 'center',
    marginBottom: spacing.xs,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 20,
    color: colors.primaryDeep,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.textSecondary,
  },
  list: {
    maxHeight: 350,
    flexShrink: 1,
    marginTop: spacing.xs,
  },
  listContent: {
    gap: spacing.sm,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  optionPressed: {
    backgroundColor: colors.primarySoft,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: colors.primary,
  },
  avatarText: {
    fontFamily: fonts.bold,
    fontSize: 12,
    color: colors.primaryDark,
  },
  avatarTextSelected: {
    color: colors.textOnPrimary,
  },
  optionText: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: {
    flexShrink: 1,
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.text,
  },
  semesterBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  semesterBadgeSelected: {
    backgroundColor: colors.primary,
  },
  semesterText: {
    fontFamily: fonts.bold,
    fontSize: 10,
    color: colors.primaryDark,
  },
  semesterTextSelected: {
    color: colors.textOnPrimary,
  },
  code: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.textSecondary,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: colors.neutralBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: colors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.md,
    marginTop: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  emptyIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primarySofter,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: colors.neutralBg,
  },
  cancelText: {
    fontFamily: fonts.semiBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  confirmButton: {
    backgroundColor: colors.primary,
  },
  confirmButtonDisabled: {
    backgroundColor: colors.borderStrong,
  },
  confirmText: {
    fontFamily: fonts.bold,
    fontSize: 14,
    color: colors.textOnPrimary,
  },
  buttonPressed: {
    opacity: 0.85,
  },
});
