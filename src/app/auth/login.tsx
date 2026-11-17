import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import {
  AuthDivider,
  AuthError,
  AuthGoogleButton,
  AuthLink,
  AuthNotice,
  AuthScreen,
  AuthSubmitButton,
  AuthTextField,
} from '../../features/auth/AuthScreen';
import { useRefreshAuthSession } from '../../features/auth/AuthSessionContext';
import PraktikanAccountPicker from '../../features/auth/PraktikanAccountPicker';
import {
  praktikanAccounts,
  type PraktikanAccount,
} from '../../features/auth/praktikanAccounts';
import {
  getAuthErrorMessage,
  isGoogleSignInAvailable,
  isValidEmail,
  sendPasswordReset,
  signInWithEmailAndPasswordForProfile,
  signInWithGoogleForProfile,
} from '../../services/authService';
import { colors, fonts, spacing } from '../../theme';

export default function LoginScreen() {
  const refreshSession = useRefreshAuthSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<'email' | 'google' | 'reset' | null>(null);
  const [accountPickerVisible, setAccountPickerVisible] = useState(false);
  const googleSignInAvailable = isGoogleSignInAvailable();

  const handleSelectAccount = (account: PraktikanAccount) => {
    setEmail(account.email);
    setAccountPickerVisible(false);
    setErrorMessage(null);
    setNoticeMessage(null);
  };

  const handleLogin = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    if (!isValidEmail(email) || !password) {
      setErrorMessage('Masukkan email yang valid dan kata sandi.');
      return;
    }
    setLoading('email');
    try {
      await signInWithEmailAndPasswordForProfile(email, password);
      await refreshSession?.();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    setLoading('google');
    try {
      const result = await signInWithGoogleForProfile();
      if (result?.status === 'registration-required') {
        router.push({
          pathname: '/auth/register',
          params: {
            provider: 'google',
            name: result.name,
            email: result.email,
          },
        });
      } else if (result?.status === 'authenticated') {
        await refreshSession?.();
      }
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  const handlePasswordReset = async () => {
    setErrorMessage(null);
    setNoticeMessage(null);
    if (!isValidEmail(email)) {
      setErrorMessage('Isi email di atas dulu, lalu minta tautan reset kata sandi.');
      return;
    }
    setLoading('reset');
    try {
      await sendPasswordReset(email);
      setNoticeMessage('Kalau email terdaftar, tautan reset kata sandi akan segera dikirim.');
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(null);
    }
  };

  return (
    <AuthScreen
      title="Yuk, masuk!"
      subtitle="Jadwal dan presensimu sudah menunggu."
      footer={
        <AuthLink
          label="Belum punya akun?"
          linkText="Daftar dulu"
          onPress={() => router.push('/auth/register')}
        />
      }
    >
      <Text style={styles.formTitle}>Senang melihatmu lagi</Text>
      <Text style={styles.formSubtitle}>Masuk dengan akun TandaIU-mu.</Text>
      {errorMessage ? <AuthError message={errorMessage} /> : null}
      {noticeMessage ? <AuthNotice message={noticeMessage} /> : null}

      <AuthTextField
        accessibilityLabel="Email"
        actionIcon="people-outline"
        actionLabel="Pilih akun praktikan"
        autoCapitalize="none"
        icon="mail-outline"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        onPressAction={() => setAccountPickerVisible(true)}
        placeholder="nama@email.com"
        returnKeyType="next"
        textContentType="emailAddress"
        value={email}
        editable={loading === null}
      />
      <AuthTextField
        accessibilityLabel="Kata sandi"
        icon="lock-closed-outline"
        label="Kata sandi"
        onChangeText={setPassword}
        onSubmitEditing={handleLogin}
        placeholder="Masukkan kata sandi"
        returnKeyType="go"
        secureTextEntry
        textContentType="password"
        value={password}
        editable={loading === null}
      />
      <Pressable
        accessibilityRole="button"
        disabled={loading !== null}
        onPress={handlePasswordReset}
        style={styles.forgotButton}
      >
        {loading === 'reset' ? (
          <Text style={styles.forgotText}>Mengirim tautan...</Text>
        ) : (
          <Text style={styles.forgotText}>Lupa kata sandi?</Text>
        )}
      </Pressable>
      <AuthSubmitButton
        label="Masuk dengan email"
        loading={loading === 'email'}
        disabled={loading !== null && loading !== 'email'}
        onPress={handleLogin}
      />
      <AuthDivider label="atau" />
      <AuthGoogleButton
        label="Lanjutkan dengan Google"
        loading={loading === 'google'}
        disabled={!googleSignInAvailable || (loading !== null && loading !== 'google')}
        onPress={handleGoogleSignIn}
      />
      {!googleSignInAvailable ? (
        <AuthNotice message="Google Sign-In perlu development build. Masuk dengan email tetap bisa digunakan." />
      ) : null}

      <PraktikanAccountPicker
        accounts={praktikanAccounts}
        onClose={() => setAccountPickerVisible(false)}
        onSelect={handleSelectAccount}
        visible={accountPickerVisible}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  formTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 25,
  },
  formSubtitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 13,
  },
  forgotButton: {
    minHeight: 40,
    alignSelf: 'flex-end',
    justifyContent: 'center',
    marginTop: -spacing.xs,
  },
  forgotText: {
    color: colors.primaryDark,
    fontFamily: fonts.semiBold,
    fontSize: 12,
  },
});
