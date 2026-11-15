import { router } from 'expo-router';
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuthSession } from '../features/auth/AuthSessionContext';
import {
  getGuardDecision,
  type AuthSessionState,
  type UserRole,
} from '../features/auth/authTypes';
import { colors, fonts, radius, spacing } from '../theme';

type ProtectedRouteProps = {
  children: ReactNode;
  allowedRoles?: readonly UserRole[];
};

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const session = useAuthSession();
  if (!session) {
    return (
      <AuthGateMessage
        message="Pasang AuthProvider di layout utama sebelum memakai pelindung halaman."
        onPress={() => router.replace('/auth/login')}
      />
    );
  }
  return (
    <ProtectedRouteContent session={session} allowedRoles={allowedRoles}>
      {children}
    </ProtectedRouteContent>
  );
}

function ProtectedRouteContent({
  children,
  allowedRoles,
  session,
}: ProtectedRouteProps & { session: AuthSessionState }) {
  const decision = getGuardDecision(session, allowedRoles);
  const profile = session.status === 'authenticated' ? session.profile : null;

  useEffect(() => {
    if (decision === 'login') {
      router.replace('/');
    } else if (decision === 'error') {
      router.replace('/auth/login');
    } else if (decision === 'forbidden' && profile) {
      router.replace(profile.role === 'assistant' ? '/assistant' : '/praktikan');
    }
  }, [decision, profile]);

  if (decision === 'loading') {
    return (
      <View style={styles.loading} accessibilityRole="progressbar">
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={styles.loadingText}>Memeriksa akunmu...</Text>
      </View>
    );
  }
  if (decision !== 'allow') {
    const message =
      decision === 'error' && session.status === 'error'
        ? session.message
        : decision === 'forbidden'
          ? 'Halaman ini hanya untuk peran lain.'
          : 'Silakan masuk untuk melanjutkan.';
    return <AuthGateMessage message={message} onPress={() => router.replace('/auth/login')} />;
  }

  return children;
}

function AuthGateMessage({ message, onPress }: { message: string; onPress: () => void }) {
  return (
    <View style={styles.messageContainer}>
      <Text style={styles.messageTitle}>Belum bisa masuk</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable accessibilityRole="button" onPress={onPress} style={styles.button}>
        <Text style={styles.buttonLabel}>Ke halaman masuk</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  loadingText: {
    color: colors.textSecondary,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  messageContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  messageTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.heading,
    fontSize: 20,
  },
  message: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
  },
  button: {
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    backgroundColor: colors.primary,
  },
  buttonLabel: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
