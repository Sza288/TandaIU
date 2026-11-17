import { Ionicons } from '@expo/vector-icons';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { colors, fonts, radius, spacing } from '../../theme';
import type { PraktikanAccount } from './praktikanAccounts';

type Props = {
  visible: boolean;
  accounts: readonly PraktikanAccount[];
  onSelect: (account: PraktikanAccount) => void;
  onClose: () => void;
};

export default function PraktikanAccountPicker({
  visible,
  accounts,
  onSelect,
  onClose,
}: Props) {
  return (
    <Modal
      animationType="fade"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Tutup daftar akun"
          onPress={onClose}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.sheet} accessibilityViewIsModal>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>Pilih Akun Pengguna</Text>
              <Text style={styles.subtitle}>
                Ketuk salah satu akun untuk mengisi email.
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Tutup"
              hitSlop={8}
              onPress={onClose}
            >
              <Ionicons name="close" size={20} color={colors.textSecondary} />
            </Pressable>
          </View>

          <FlatList
            data={accounts}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Pilih ${item.name}, ${item.semester ? `semester ${item.semester}` : item.note ?? 'akun uji'}`}
                onPress={() => onSelect(item)}
                style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {item.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.semester}>
                    {item.semester ? `Semester ${item.semester}` : item.note ?? 'Akun uji'}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={colors.primary} />
              </Pressable>
            )}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: 'rgba(31, 36, 48, 0.45)',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '78%',
    padding: spacing.lg,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  headerCopy: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 18,
  },
  subtitle: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
  list: {
    flexGrow: 0,
  },
  listContent: {
    paddingBottom: spacing.xs,
  },
  separator: {
    height: spacing.sm,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  cardPressed: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  avatar: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
  },
  avatarText: {
    color: colors.primaryDark,
    fontFamily: fonts.bold,
    fontSize: 14,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  name: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 14,
  },
  semester: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 11,
  },
});
