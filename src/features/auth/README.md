# Auth integration notes

The login and registration routes use the shared Firebase instances and validate
`users/{uid}` before trusting a role. Firestore roles `praktikan` and `asisten`
are resolved to the app's `praktikan` and `assistant` routes respectively.
Profiles are keyed by the Firebase Auth UID; a duplicated `uid` field and
`studentCode` are optional for provisioned accounts. Public registration lets
users choose `praktikan` or `asisten`. New Google accounts complete the same
profile fields after their first successful Google sign-in.

## PM integration

- `src/app/_layout.tsx` provides the auth session and guards private routes.
  `/`, `/auth/login`, and `/auth/register` remain public; dashboard routes are
  limited to their matching profile role.
- `ProtectedRoute` remains available for screens that need a route-level guard
  outside the root route groups.
- Call `signOut` from `src/services/authService.ts` for logout. It signs out and
  returns to the public landing page.

## Decisions and security limits

- Self-service role selection is enforced by the Firestore Rules. Keep those
  rules aligned with the app's `praktikan` and `asisten` role values and allow
  each authenticated user to create and read only `users/{request.auth.uid}`.
- Firestore Rules must ensure users can create and read only their own profile
  and cannot modify another user's role. The profile's Firestore `role` field
  is not a Firebase Auth custom claim; rules that check
  `request.auth.token.role` need trusted custom-claim provisioning instead.
- `src/lib/firebase.ts` initializes native Auth with Firebase's React Native
  persistence backed by AsyncStorage. Web keeps Firebase's browser persistence.

## Google Sign-In setup

- Enable Google as a sign-in provider in Firebase Authentication and register
  the app's Android package and SHA-1 in Firebase.
- Provide `google-services.json` at the project root and set
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` to the OAuth web client ID used by Firebase.
  `app.config.js` includes the Android config file automatically when it exists.
- Build and install a development build after adding the native Google Sign-In
  module. The native module is loaded only when the feature is used; Google
  Sign-In is unavailable in Expo Go, where the email login remains available.
- Web uses Firebase's Google popup flow and requires the deployed domain to be
  authorized in Firebase Authentication.
