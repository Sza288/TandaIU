import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  AuthError,
  AuthLink,
  AuthScreen,
  AuthSubmitButton,
  AuthTextField,
} from '../../features/auth/AuthScreen';
import { useRefreshAuthSession } from '../../features/auth/AuthSessionContext';
import {
  getAuthErrorMessage,
  registerWithEmailAndPassword,
  registerGoogleProfile,
  validateGoogleProfileInput,
  validateRegistrationInput,
} from '../../services/authService';
import type { RegistrationRole } from '../../features/auth/authTypes';
import { colors, fonts, spacing } from '../../theme';

export default function RegisterScreen() {
  const params = useLocalSearchParams<{ provider?: string; name?: string; email?: string }>();
  const isGoogleRegistration = params.provider === 'google';
  const [name, setName] = useState(params.name ?? '');
  const [email, setEmail] = useState(params.email ?? '');
  const [role, setRole] = useState<RegistrationRole>('praktikan');
  const [studentCode, setStudentCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const refreshSession = useRefreshAuthSession();

  const handleRegister = async () => {
    setErrorMessage(null);
    const input = { name, email, password, confirmPassword, studentCode, role };
    const validationMessage = isGoogleRegistration
      ? validateGoogleProfileInput({ name, role, studentCode })
      : validateRegistrationInput(input);
    if (validationMessage) {
      setErrorMessage(validationMessage);
      return;
    }

    setLoading(true);
    try {
      if (isGoogleRegistration) {
        await registerGoogleProfile({ name, role, studentCode });
      } else {
        await registerWithEmailAndPassword(input);
      }
      await refreshSession?.();
    } catch (error) {
      setErrorMessage(getAuthErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthScreen
      title={isGoogleRegistration ? 'Lengkapi profil' : 'Buat akun'}
      subtitle={isGoogleRegistration
        ? 'Pilih peran agar kami dapat menyiapkan akun TandaIU-mu.'
        : 'Daftar sebagai praktikan atau asisten TandaIU.'}
      footer={
        <AuthLink
          label="Sudah punya akun?"
          linkText="Masuk"
          onPress={() => router.replace('/auth/login')}
        />
      }
    >
      <Text style={styles.formTitle}>{isGoogleRegistration ? 'Data akun Google' : 'Kenalan dulu'}</Text>
      <Text style={styles.formSubtitle}>Data diri</Text>
      {errorMessage ? <AuthError message={errorMessage} /> : null}

      <Text style={styles.label}>Daftar sebagai</Text>
      <View style={styles.roleOptions}>
        {([
          { value: 'praktikan', label: 'Praktikan', description: 'Mengikuti praktikum' },
          { value: 'asisten', label: 'Asisten', description: 'Mendampingi praktikum' },
        ] as const).map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityState={{ selected: role === option.value, disabled: loading }}
            disabled={loading}
            onPress={() => setRole(option.value)}
            style={[styles.roleOption, role === option.value && styles.roleOptionSelected]}
          >
            <Text style={[styles.roleTitle, role === option.value && styles.roleTitleSelected]}>
              {option.label}
            </Text>
            <Text style={styles.roleDescription}>{option.description}</Text>
          </Pressable>
        ))}
      </View>

      <AuthTextField
        accessibilityLabel="Nama lengkap"
        autoCapitalize="words"
        icon="person-outline"
        label="Nama lengkap"
        onChangeText={setName}
        placeholder="Nama sesuai identitas"
        textContentType="name"
        value={name}
        editable={!loading}
      />
      {!isGoogleRegistration ? <AuthTextField
        accessibilityLabel="Email"
        icon="mail-outline"
        keyboardType="email-address"
        label="Email"
        onChangeText={setEmail}
        placeholder="nama@email.com"
        textContentType="emailAddress"
        value={email}
        editable={!loading}
      /> : <AuthTextField
        accessibilityLabel="Email Google"
        icon="mail-outline"
        label="Email Google"
        onChangeText={setEmail}
        placeholder="Email akun Google"
        value={email}
        editable={false}
      />}
      {role === 'praktikan' ? <AuthTextField
        accessibilityLabel="Kode mahasiswa"
        icon="card-outline"
        keyboardType="default"
        label="Kode mahasiswa"
        onChangeText={setStudentCode}
        placeholder="Masukkan kode mahasiswa"
        textContentType="none"
        value={studentCode}
        editable={!loading}
      /> : null}
      {!isGoogleRegistration ? <>
      <Text style={styles.formSubtitle}>Keamanan akun</Text>
      <AuthTextField
        accessibilityLabel="Kata sandi"
        icon="lock-closed-outline"
        label="Kata sandi"
        onChangeText={setPassword}
        placeholder="Minimal 6 karakter"
        secureTextEntry
        textContentType="newPassword"
        value={password}
        editable={!loading}
      />
      <AuthTextField
        accessibilityLabel="Konfirmasi kata sandi"
        icon="shield-checkmark-outline"
        label="Konfirmasi kata sandi"
        onChangeText={setConfirmPassword}
        onSubmitEditing={handleRegister}
        placeholder="Ketik ulang kata sandi"
        returnKeyType="done"
        secureTextEntry
        textContentType="newPassword"
        value={confirmPassword}
        editable={!loading}
      />
      </> : null}
      <AuthSubmitButton
        label={isGoogleRegistration ? 'Selesaikan pendaftaran' : 'Buat akun'}
        loading={loading}
        onPress={handleRegister}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 12,
    marginBottom: spacing.sm,
  },
  roleOptions: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  roleOption: {
    flex: 1,
    minHeight: 68,
    justifyContent: 'center',
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  roleOptionSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primarySofter,
  },
  roleTitle: {
    color: colors.text,
    fontFamily: fonts.semiBold,
    fontSize: 13,
  },
  roleTitleSelected: {
    color: colors.primaryDeep,
  },
  roleDescription: {
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 10,
    marginTop: 3,
  },
  formTitle: {
    color: colors.text,
    fontFamily: fonts.heading,
    fontSize: 19,
    lineHeight: 25,
  },
  formSubtitle: {
    marginTop: spacing.sm,
    marginBottom: spacing.md,
    color: colors.textSecondary,
    fontFamily: fonts.regular,
    fontSize: 12,
  },
});
