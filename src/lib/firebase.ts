import { initializeApp, type FirebaseApp } from 'firebase/app'
import {
  GoogleAuthProvider,
  getAuth,
  getRedirectResult,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  type Auth,
} from 'firebase/auth'

/**
 * Firebase web configuration.
 *
 * These values are public identifiers that ship inside every Firebase web client — they are not
 * secrets. Access is controlled by Firebase Security Rules, by the authorised-domain list in
 * Firebase Authentication, and (recommended) by an HTTP-referrer restriction on the API key in
 * Google Cloud Console. Override any value with a VITE_FIREBASE_* build-time variable.
 */
export const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? 'AIzaSyDnd3_rhaFXrA1OQrxWpcUf9q92_O-ZLGs',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? 'crm-app-dc6d5.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'crm-app-dc6d5',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ?? 'crm-app-dc6d5.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_SENDER_ID ?? '1021642655900',
  appId: import.meta.env.VITE_FIREBASE_APP_ID ?? '1:1021642655900:web:aa5cddc02b3d1cfd8d4559',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID ?? 'G-EZ744ND1VT',
}

let app: FirebaseApp | null = null
let auth: Auth | null = null

export function firebaseApp(): FirebaseApp {
  if (!app) app = initializeApp(firebaseConfig)
  return app
}

export function firebaseAuth(): Auth {
  if (!auth) auth = getAuth(firebaseApp())
  return auth
}

/** Google SSO: returns a freshly minted Firebase ID token for the Worker to verify. */
export async function signInWithGoogle(): Promise<string> {
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  try {
    const result = await signInWithPopup(firebaseAuth(), provider)
    return result.user.getIdToken(true)
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
    // A blocked popup is recoverable: retry with a full-page redirect, which the caller's
    // getRedirectIdToken() picks up when the provider sends the browser back.
    if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
      await signInWithRedirect(firebaseAuth(), provider)
      throw new Error('REDIRECT_STARTED')
    }
    throw error
  }
}

/**
 * Completes a redirect-based Google sign-in. Firebase appends its result to the current URL, so this
 * must run once on the login page. Returns null when the page load was not a redirect return.
 */
export async function getRedirectIdToken(): Promise<string | null> {
  try {
    const result = await getRedirectResult(firebaseAuth())
    if (!result) return null
    return result.user.getIdToken(true)
  } catch {
    return null
  }
}

/** The host Firebase must know about for the current page to complete sign-in. */
export function currentAuthHost(): string {
  return typeof window === 'undefined' ? '' : window.location.hostname
}

export async function firebaseSignOut(): Promise<void> {
  if (auth) await signOut(auth).catch(() => undefined)
}

/** Human-readable messages for the Firebase error codes a user can actually hit. */
export function firebaseErrorText(error: unknown): string {
  const code = typeof error === 'object' && error && 'code' in error ? String((error as { code: unknown }).code) : ''
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
      return 'Google sign-in was closed before it finished.'
    case 'auth/popup-blocked':
      return 'The browser blocked the Google sign-in window. Allow pop-ups for this site and try again.'
    case 'auth/unauthorized-domain':
      return 'This domain is not yet authorised in Firebase Authentication → Settings → Authorised domains.'
    case 'auth/operation-not-allowed':
      return 'The Google provider is not enabled in Firebase Authentication → Sign-in method.'
    case 'auth/network-request-failed':
      return 'Could not reach Firebase. Check the network connection and try again.'
    case 'auth/account-exists-with-different-credential':
      return 'That email already exists with a different sign-in method.'
    case 'auth/too-many-requests':
      return 'Too many attempts. Wait a moment and try again.'
    default:
      return error instanceof Error ? error.message : 'Google sign-in failed.'
  }
}

/**
 * Firebase Analytics is optional and browser-only. It is loaded lazily so the SDK never blocks
 * first paint, and failures are swallowed because measurement must not break the app.
 */
let analyticsStarted = false
export async function initAnalytics(): Promise<void> {
  if (analyticsStarted || typeof window === 'undefined' || !firebaseConfig.measurementId) return
  analyticsStarted = true
  try {
    const { getAnalytics, isSupported } = await import('firebase/analytics')
    if (await isSupported()) getAnalytics(firebaseApp())
  } catch {
    /* analytics is best-effort only */
  }
}
