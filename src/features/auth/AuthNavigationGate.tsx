import { router, usePathname } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import ProtectedRoute from '../../components/ProtectedRoute';
import { colors, fonts, spacing } from '../../theme';
import { getAuthErrorMessage, signOut } from '../../services/authService';
import { useAuthSession, useRefreshAuthSession } from './AuthSessionContext';
import { getAuthNavigationTarget, type UserRole } from './authTypes';

type AuthNavigationGateProps = {
  children: ReactNode;
};

function requiredRoles(pathname: string): readonly UserRole[] | undefined {
  if (pathname === '/assistant' || pathname.startsWith('/assistant/')) {
    return ['asisten'];
  }
  if (pathname === '/praktikan' || pathname.startsWith('/praktikan/')) {
    return ['praktikan'];
  }
  return undefined;
}

export default function AuthNavigationGate({ children }: AuthNavigationGateProps) {
  const pathname = usePathname();
  const session = useAuthSession();
  const navigationTarget = session ? getAuthNavigationTarget(session, pathname) : null;
  const pendingNavigationTarget = useRef<string | null>(null);

  useEffect(() => {
    if (!navigationTarget) {
      pendingNavigationTarget.current = null;
      return;
    }
    if (pendingNavigationTarget.current !== navigationTarget) {
      pendingNavigationTarget.current = navigationTarget;
      router.replace(navigationTarget);
    }
  }, [navigationTarget]);

  if (!session || session.status === 'loading') {
    return <AuthLoadingScreen />;
  }
  const canCompleteGoogleRegistration =
    session.status === 'error' &&
    session.googleRegistrationAllowed === true &&
    (pathname === '/auth/login' || pathname === '/auth/register');
  if (session.status === 'error' && !canCompleteGoogleRegistration) {
    return <AuthProfileRecovery message={session.message} />;
  }
  if (navigationTarget) {
    return <AuthLoadingScreen />;
  }
  if (session.status === 'authenticated') {
    return (
      <ProtectedRoute allowedRoles={requiredRoles(pathname)}>
        {children}
      </ProtectedRoute>
    );
  }
  return children;
}

function AuthProfileRecovery({ message }: { message: string }) {
  const refreshSession = useRefreshAuthSession();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const retryProfile = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await refreshSession?.();
    } catch (error) {
      setActionError(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const returnToLanding = async () => {
    setBusy(true);
    setActionError(null);
    try {
      await signOut();
    } catch (error) {
      setActionError(getAuthErrorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.brand}>TandaIU</Text>
      <Text style={styles.errorTitle}>Profil akun belum siap</Text>
      <Text style={styles.label}>{message}</Text>
      {actionError ? <Text style={styles.errorMessage}>{actionError}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={retryProfile}
        style={styles.actionButton}
      >
        <Text style={styles.actionLabel}>{busy ? 'Memeriksa...' : 'Coba lagi'}</Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={returnToLanding}
        style={styles.secondaryButton}
      >
        <Text style={styles.secondaryLabel}>Keluar dan kembali</Text>
      </Pressable>
    </View>
  );
}

function AuthLoadingScreen() {
  return (
    <View style={styles.container} accessibilityRole="progressbar">
      <Text style={styles.brand}>TandaIU</Text>
      <ActivityIndicator color={colors.primary} />
      <Text style={styles.label}>Menyiapkan sesi...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    backgroundColor: colors.background,
  },
  brand: {
    color: colors.primaryDark,
    fontFamily: fonts.brand,
    fontSize: 24,
  },
  label: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
  },
  errorTitle: {
    color: colors.primaryDeep,
    fontFamily: fonts.bold,
    fontSize: 18,
  },
  errorMessage: {
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 13,
    textAlign: 'center',
  },
  actionButton: {
    minHeight: 46,
    minWidth: 160,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 24,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.xl,
  },
  actionLabel: {
    color: colors.textOnPrimary,
    fontFamily: fonts.bold,
    fontSize: 13,
  },
  secondaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryLabel: {
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
});
