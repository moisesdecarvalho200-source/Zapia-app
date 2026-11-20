import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
  Auth,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  setDoc,
  deleteDoc,
  collection,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Firestore,
  Timestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { PersonaId, ThemeId, VoiceGenderMode, sanitizeFirestoreId } from '../utils/zapiaLogic';

export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/contacts.readonly',
] as const;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;
let dbInstance: Firestore | null = null;

// Strictly in-memory OAuth access token storage per account email (never stored in localStorage/sessionStorage)
const inMemoryTokenByEmail = new Map<string, string>();
let activeAccessToken: string | null = null;

export function getFirebaseServices(): { app: FirebaseApp; auth: Auth; db: Firestore } {
  if (!appInstance) {
    appInstance = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
    authInstance = getAuth(appInstance);
    const dbId = (firebaseConfig as { firestoreDatabaseId?: string }).firestoreDatabaseId;
    dbInstance = dbId ? getFirestore(appInstance, dbId) : getFirestore(appInstance);
  }
  return {
    app: appInstance,
    auth: authInstance!,
    db: dbInstance!,
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const { auth } = getFirebaseServices();
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testFirestoreConnection(): Promise<boolean> {
  try {
    const { db } = getFirebaseServices();
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    return true;
  }
}

export function initFirebaseAuth(
  onAuthChange: (user: User | null, accessToken: string | null) => void
): () => void {
  const { auth } = getFirebaseServices();
  return onAuthStateChanged(auth, (user) => {
    if (user && user.email) {
      const token = inMemoryTokenByEmail.get(user.email) ?? activeAccessToken ?? null;
      onAuthChange(user, token);
    } else {
      activeAccessToken = null;
      onAuthChange(null, null);
    }
  });
}

export async function signInWithGoogleWorkspace(
  loginHint?: string
): Promise<{ user: User; accessToken: string }> {
  const { auth } = getFirebaseServices();
  const provider = new GoogleAuthProvider();
  for (const scope of WORKSPACE_SCOPES) {
    provider.addScope(scope);
  }
  provider.setCustomParameters({
    prompt: 'select_account',
    ...(loginHint ? { login_hint: loginHint } : {}),
  });

  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential?.accessToken || '';
  if (token && result.user.email) {
    inMemoryTokenByEmail.set(result.user.email, token);
    activeAccessToken = token;
  }
  return { user: result.user, accessToken: token };
}

export function getInMemoryAccessToken(email?: string | null): string | null {
  if (email && inMemoryTokenByEmail.has(email)) {
    return inMemoryTokenByEmail.get(email) ?? null;
  }
  return activeAccessToken;
}

export async function signOutWorkspace(): Promise<void> {
  const { auth } = getFirebaseServices();
  activeAccessToken = null;
  inMemoryTokenByEmail.clear();
  await auth.signOut();
}

export async function ensureUserProfileInFirestore(
  user: User,
  settings: {
    persona: PersonaId;
    voiceGender: VoiceGenderMode;
    themeId: ThemeId;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  const { db } = getFirebaseServices();
  const userPath = `users/${user.uid}`;
  try {
    await setDoc(
      doc(db, 'users', user.uid),
      {
        uid: user.uid,
        displayName: (user.displayName || 'Moisés de Carvalho').slice(0, 120),
        email: (user.email || 'usuario@zapia.local').slice(0, 200),
        preferredPersona: settings.persona,
        preferredVoiceGender: settings.voiceGender,
        themeId: settings.themeId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (err) {
    // If profile already exists, try update without touching createdAt
    try {
      await setDoc(
        doc(db, 'users', user.uid),
        {
          uid: user.uid,
          displayName: (user.displayName || 'Moisés de Carvalho').slice(0, 120),
          email: (user.email || 'usuario@zapia.local').slice(0, 200),
          preferredPersona: settings.persona,
          preferredVoiceGender: settings.voiceGender,
          themeId: settings.themeId,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch {
      handleFirestoreError(err, OperationType.WRITE, userPath);
    }
  }
}

export async function syncVaultItemToFirestore(
  user: User,
  item: {
    id: string;
    title: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string;
    encryptedPayload: string;
    iv: string;
    scanStatus: 'limpo' | 'alerta' | 'quarentena';
    driveFileId?: string;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  const { db } = getFirebaseServices();
  const safeId = sanitizeFirestoreId(item.id);
  const path = `users/${user.uid}/vaultItems/${safeId}`;
  // Bounded payload check for Firestore 1MB doc limit
  const boundedPayload = item.encryptedPayload.slice(0, 240000);
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      ownerId: user.uid,
      title: item.title.slice(0, 180),
      mimeType: item.mimeType.slice(0, 120),
      sizeBytes: Math.min(item.sizeBytes, 52428800),
      sha256: item.sha256,
      encryptedPayload: boundedPayload,
      iv: item.iv.slice(0, 64),
      scanStatus: item.scanStatus,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (item.driveFileId) {
      payload.driveFileId = item.driveFileId.slice(0, 256);
    }
    await setDoc(doc(db, 'users', user.uid, 'vaultItems', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncPreferenceToFirestore(
  user: User,
  pref: {
    id: string;
    category: 'rotina' | 'voz' | 'estilo' | 'atalho' | 'contato';
    key: string;
    value: string;
    confidence: number;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  const { db } = getFirebaseServices();
  const safeId = sanitizeFirestoreId(pref.id);
  const path = `users/${user.uid}/preferences/${safeId}`;
  try {
    await setDoc(doc(db, 'users', user.uid, 'preferences', safeId), {
      id: safeId,
      ownerId: user.uid,
      category: pref.category,
      key: pref.key.slice(0, 100),
      value: pref.value.slice(0, 500),
      confidence: Math.max(0, Math.min(100, pref.confidence)),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function syncReminderToFirestore(
  user: User,
  rem: {
    id: string;
    title: string;
    dueAtIso: string;
    status: 'pendente' | 'concluido';
    calendarEventId?: string;
  }
): Promise<void> {
  if (!user.emailVerified) return;
  const { db } = getFirebaseServices();
  const safeId = sanitizeFirestoreId(rem.id);
  const path = `users/${user.uid}/reminders/${safeId}`;
  try {
    const payload: Record<string, unknown> = {
      id: safeId,
      ownerId: user.uid,
      title: rem.title.slice(0, 200),
      dueAtIso: rem.dueAtIso.slice(0, 64),
      status: rem.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    if (rem.calendarEventId) {
      payload.calendarEventId = rem.calendarEventId.slice(0, 256);
    }
    await setDoc(doc(db, 'users', user.uid, 'reminders', safeId), payload);
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function deleteSubcollectionDoc(
  user: User,
  subcollection: 'vaultItems' | 'preferences' | 'reminders' | 'messages',
  id: string
): Promise<void> {
  if (!user.emailVerified) return;
  const { db } = getFirebaseServices();
  const safeId = sanitizeFirestoreId(id);
  const path = `users/${user.uid}/${subcollection}/${safeId}`;
  try {
    await deleteDoc(doc(db, 'users', user.uid, subcollection, safeId));
  } catch (err) {
    handleFirestoreError(err, OperationType.DELETE, path);
  }
}

export function subscribeUserVault(
  user: User,
  onData: (items: Array<Record<string, unknown>>) => void
): () => void {
  const { db } = getFirebaseServices();
  const path = `users/${user.uid}/vaultItems`;
  const q = query(collection(db, 'users', user.uid, 'vaultItems'), where('ownerId', '==', user.uid));
  return onSnapshot(
    q,
    (snap) => {
      const docs = snap.docs.map((d) => {
        const data = d.data();
        const createdAt = data.createdAt instanceof Timestamp ? data.createdAt.toDate().toISOString() : new Date().toISOString();
        const updatedAt = data.updatedAt instanceof Timestamp ? data.updatedAt.toDate().toISOString() : createdAt;
        return { ...data, createdAtIso: createdAt, updatedAtIso: updatedAt };
      });
      onData(docs);
    },
    (error) => {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  );
}

// ============================================================================
// Google Workspace Real API Helpers (Drive, Photos via Drive, Gmail, Calendar, Contacts)
// ============================================================================

export interface DriveFileSummary {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  webViewLink?: string;
  thumbnailLink?: string;
}

export async function fetchDriveFiles(accessToken: string, queryFilter?: string): Promise<DriveFileSummary[]> {
  const params = new URLSearchParams({
    pageSize: '20',
    fields: 'files(id,name,mimeType,size,modifiedTime,webViewLink,thumbnailLink)',
    orderBy: 'modifiedTime desc',
  });
  if (queryFilter) {
    params.set('q', queryFilter);
  }
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Drive (${res.status}): ${text.slice(0, 180)}`);
  }
  const data = (await res.json()) as { files?: DriveFileSummary[] };
  return data.files || [];
}

export async function uploadFileToDrive(
  accessToken: string,
  fileName: string,
  mimeType: string,
  bytes: Uint8Array
): Promise<DriveFileSummary> {
  const metadata = { name: fileName, mimeType };
  const form = new FormData();
  form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  form.append('file', new Blob([copy.buffer], { type: mimeType }));

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Upload Drive falhou (${res.status}): ${text.slice(0, 160)}`);
  }
  return (await res.json()) as DriveFileSummary;
}

export interface GmailMessageSummary {
  id: string;
  subject: string;
  from: string;
  snippet: string;
  date: string;
}

export async function fetchGmailMessages(accessToken: string): Promise<GmailMessageSummary[]> {
  const listRes = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=8', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listRes.ok) {
    const text = await listRes.text();
    throw new Error(`Gmail (${listRes.status}): ${text.slice(0, 160)}`);
  }
  const listData = (await listRes.json()) as { messages?: Array<{ id: string }> };
  const ids = (listData.messages || []).slice(0, 6);

  const detailed = await Promise.all(
    ids.map(async (m) => {
      const msgRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${m.id}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!msgRes.ok) return null;
      const msg = (await msgRes.json()) as {
        id: string;
        snippet?: string;
        payload?: { headers?: Array<{ name: string; value: string }> };
      };
      const headers = msg.payload?.headers || [];
      const getHeader = (name: string) => headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value || '';
      return {
        id: msg.id,
        subject: getHeader('Subject') || '(Sem assunto)',
        from: getHeader('From') || 'Remetente desconhecido',
        snippet: msg.snippet || '',
        date: getHeader('Date') || '',
      };
    })
  );
  return detailed.filter((x): x is GmailMessageSummary => x !== null);
}

export async function sendGmailMessage(
  accessToken: string,
  to: string,
  subject: string,
  bodyText: string
): Promise<void> {
  const mime = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    bodyText,
  ].join('\r\n');
  const raw = btoa(unescape(encodeURIComponent(mime)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Envio Gmail (${res.status}): ${text.slice(0, 160)}`);
  }
}

export interface CalendarEventSummary {
  id: string;
  summary: string;
  startIso: string;
  htmlLink?: string;
}

export async function fetchCalendarEvents(accessToken: string): Promise<CalendarEventSummary[]> {
  const now = new Date().toISOString();
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin=${encodeURIComponent(now)}&maxResults=10&singleEvents=true&orderBy=startTime`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Google Agenda (${res.status}): ${text.slice(0, 160)}`);
  }
  const data = (await res.json()) as {
    items?: Array<{ id: string; summary?: string; start?: { dateTime?: string; date?: string }; htmlLink?: string }>;
  };
  return (data.items || []).map((e) => ({
    id: e.id,
    summary: e.summary || 'Evento sem título',
    startIso: e.start?.dateTime || e.start?.date || now,
    htmlLink: e.htmlLink,
  }));
}

export async function createCalendarEvent(
  accessToken: string,
  summary: string,
  startIso: string
): Promise<CalendarEventSummary> {
  const startDate = new Date(startIso);
  const endDate = new Date(startDate.getTime() + 30 * 60000);
  const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      summary,
      start: { dateTime: startDate.toISOString() },
      end: { dateTime: endDate.toISOString() },
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Criar evento (${res.status}): ${text.slice(0, 160)}`);
  }
  const e = (await res.json()) as { id: string; summary?: string; start?: { dateTime?: string }; htmlLink?: string };
  return {
    id: e.id,
    summary: e.summary || summary,
    startIso: e.start?.dateTime || startIso,
    htmlLink: e.htmlLink,
  };
}

export interface ContactSummary {
  name: string;
  email: string;
}

export async function fetchGoogleContacts(accessToken: string): Promise<ContactSummary[]> {
  const res = await fetch(
    'https://people.googleapis.com/v1/people/me/connections?personFields=names,emailAddresses&pageSize=20',
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) return [];
  const data = (await res.json()) as {
    connections?: Array<{
      names?: Array<{ displayName?: string }>;
      emailAddresses?: Array<{ value?: string }>;
    }>;
  };
  const contacts: ContactSummary[] = [];
  for (const person of data.connections || []) {
    const email = person.emailAddresses?.[0]?.value;
    if (email) {
      contacts.push({
        name: person.names?.[0]?.displayName || email,
        email,
      });
    }
  }
  return contacts;
}
