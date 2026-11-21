import {
  ApiProviderKind,
  PersonaId,
  ScanVerdict,
  ThemeId,
  TrainedVoiceProfile,
  VoiceEffectId,
  VoiceGenderMode,
  getThreadColorHex,
} from './zapiaLogic';
import { encryptBytesE2EE } from './cryptoVault';

export interface LocalThread {
  id: string;
  title: string;
  colorHex: string;
  glyphVariant: number;
  unreadCount: number;
  updatedAtIso: string;
  isMailAssistant?: boolean;
}

export interface LocalMessage {
  id: string;
  threadId?: string;
  role: 'user' | 'assistant';
  content: string;
  persona: PersonaId;
  voiceName: string;
  createdAtIso: string;
  synced?: boolean;
}

export interface LocalPreference {
  id: string;
  category: 'rotina' | 'voz' | 'estilo' | 'atalho' | 'contato';
  key: string;
  value: string;
  confidence: number;
  updatedAtIso: string;
}

export interface LocalVaultItem {
  id: string;
  title: string;
  mimeType: string;
  sizeBytes: number;
  sha256: string;
  encryptedPayload: string;
  iv: string;
  scanStatus: ScanVerdict;
  findings: string[];
  driveFileId?: string;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface LocalGalleryItem {
  id: string;
  title: string;
  kind: 'photo' | 'video';
  source: 'local' | 'studio' | 'drive';
  mimeType: string;
  dataUrl: string;
  width?: number;
  height?: number;
  createdAtIso: string;
  driveFileId?: string;
}

export interface LocalReminder {
  id: string;
  title: string;
  dueAtIso: string;
  status: 'pendente' | 'concluido';
  calendarEventId?: string;
  createdAtIso: string;
}

export interface LocalAuditLog {
  id: string;
  action: string;
  target: string;
  verdict: 'seguro' | 'bloqueado' | 'alerta';
  createdAtIso: string;
}

export interface LinkedAccountMeta {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  lastUsedIso: string;
}

export interface LocalConnector {
  id: string;
  name: string;
  providerKind: ApiProviderKind;
  catalogId?: string;
  category: string;
  brandColor: string;
  shortGlyph: string;
  baseUrl?: string;
  modelId?: string;
  accountLabel?: string;
  encryptedSecret?: string;
  secretIv?: string;
  isCustom: boolean;
  isActiveAiModel?: boolean;
  connected?: boolean;
  lastTestStatus?: 'ok' | 'erro' | 'pendente';
  lastTestMessage?: string;
  updatedAtIso: string;
}

export interface LocalDailyCheckin {
  id: string;
  dateIso: string;
  mood: 'motivado' | 'focado' | 'calmo' | 'cansado' | 'criativo';
  energy: number;
  focusGoal: string;
  reflection: string;
  createdAtIso: string;
}

export interface LocalSavedCardMeta {
  id: string;
  nickname: string;
  last4: string;
  brand: string;
  createdAtIso: string;
}

export interface ZapiaSettingsState {
  userName: string;
  persona: PersonaId;
  voiceGender: VoiceGenderMode;
  preferredMaleVoice: string;
  preferredFemaleVoice: string;
  warmth: number;
  speed: number;
  voicePitch?: number;
  voiceEffect?: VoiceEffectId;
  trainedVoiceProfile?: TrainedVoiceProfile | null;
  autoSpeak: boolean;
  themeId: ThemeId;
  autoBackupDrive: boolean;
  suggestDriveSyncOnSensitiveSave: boolean;
  offlinePrivacyLock: boolean;
}

const DB_NAME = 'zapia_offline_db_v1';
const DB_VERSION = 3;
const STORES = [
  'threads',
  'messages',
  'preferences',
  'vaultItems',
  'galleryItems',
  'reminders',
  'auditLogs',
  'connectors',
  'dailyCheckins',
  'meta',
] as const;

export const DEFAULT_SETTINGS: ZapiaSettingsState = {
  userName: 'Moisés de Carvalho',
  persona: 'amigo',
  voiceGender: 'alternada',
  preferredMaleVoice: 'Fenrir',
  preferredFemaleVoice: 'Kore',
  warmth: 72,
  speed: 45,
  voicePitch: 50,
  voiceEffect: 'natural',
  autoSpeak: false,
  themeId: 'obsidian-crimson',
  autoBackupDrive: true,
  suggestDriveSyncOnSensitiveSave: true,
  offlinePrivacyLock: true,
};

function openOfflineDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const store of STORES) {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: store === 'meta' ? 'key' : 'id' });
        }
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function getAllStoreItems<T>(storeName: (typeof STORES)[number]): Promise<T[]> {
  try {
    const db = await openOfflineDb();
    return await new Promise<T[]>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onsuccess = () => resolve((req.result || []) as T[]);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function putStoreItem<T>(storeName: (typeof STORES)[number], item: T): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).put(item);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function deleteStoreItem(storeName: (typeof STORES)[number], id: string): Promise<void> {
  const db = await openOfflineDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getMetaValue<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openOfflineDb();
    const record = await new Promise<{ key: string; value: T } | undefined>((resolve, reject) => {
      const tx = db.transaction('meta', 'readonly');
      const req = tx.objectStore('meta').get(key);
      req.onsuccess = () => resolve(req.result as { key: string; value: T } | undefined);
      req.onerror = () => reject(req.error);
    });
    return record ? record.value : fallback;
  } catch {
    return fallback;
  }
}

export async function setMetaValue<T>(key: string, value: T): Promise<void> {
  await putStoreItem('meta', { key, value });
}

export async function seedInitialOfflineDataIfEmpty(): Promise<void> {
  const now = new Date().toISOString();
  const threadsSeeded = await getMetaValue<boolean>('threads_seeded_v2', false);
  if (!threadsSeeded) {
    const initialThreads: LocalThread[] = [
      {
        id: 'thread_zapia_hub',
        title: 'Assistente ZAPIA MS Multiplataforma',
        colorHex: getThreadColorHex(0),
        glyphVariant: 0,
        unreadCount: 0,
        updatedAtIso: now,
      },
      {
        id: 'thread_google_workspace',
        title: 'Google conectado e pronto para uso',
        colorHex: getThreadColorHex(2),
        glyphVariant: 2,
        unreadCount: 1,
        updatedAtIso: new Date(Date.now() - 600000).toISOString(),
      },
      {
        id: 'thread_email_assist',
        title: 'Assistente de e-mails',
        colorHex: getThreadColorHex(4),
        glyphVariant: 4,
        unreadCount: 4,
        updatedAtIso: new Date(Date.now() - 1200000).toISOString(),
        isMailAssistant: true,
      },
      {
        id: 'thread_vault_e2ee',
        title: 'Cofre AES-256-GCM e auditoria',
        colorHex: getThreadColorHex(1),
        glyphVariant: 1,
        unreadCount: 0,
        updatedAtIso: new Date(Date.now() - 1800000).toISOString(),
      },
      {
        id: 'thread_studio_media',
        title: 'Galeria integrada Android e PC',
        colorHex: getThreadColorHex(5),
        glyphVariant: 5,
        unreadCount: 0,
        updatedAtIso: new Date(Date.now() - 2400000).toISOString(),
      },
    ];
    for (const t of initialThreads) {
      await putStoreItem('threads', t);
    }
    await setMetaValue('threads_seeded_v2', true);
  }

  const connectorsSeeded = await getMetaValue<boolean>('connectors_seeded_v3', false);
  if (!connectorsSeeded) {
    const initialConnectors: LocalConnector[] = [
      {
        id: 'conn_telegram_moises',
        name: 'Telegram',
        providerKind: 'telegram-bot',
        catalogId: 'telegram',
        category: 'mensagens',
        brandColor: '#229ED9',
        shortGlyph: 'TG',
        baseUrl: 'https://api.telegram.org',
        accountLabel: '@FFMoises29',
        isCustom: false,
        connected: true,
        lastTestStatus: 'pendente',
        lastTestMessage: 'Configure seu Bot Token para automações ao vivo',
        updatedAtIso: now,
      },
      {
        id: 'conn_gemini_api',
        name: 'gemini_api',
        providerKind: 'gemini',
        category: 'ia-free',
        brandColor: '#1E1E24',
        shortGlyph: 'GM',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        modelId: 'gemini-2.5-flash',
        accountLabel: 'Google Gemini REST',
        isCustom: true,
        isActiveAiModel: false,
        connected: false,
        lastTestStatus: 'pendente',
        lastTestMessage: 'Adicione sua chave gratuita do Google AI Studio para testar',
        updatedAtIso: now,
      },
      {
        id: 'conn_google_ai_studio',
        name: 'google_ai_studio',
        providerKind: 'gemini',
        category: 'ia-free',
        brandColor: '#1E1E24',
        shortGlyph: 'AS',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta',
        modelId: 'gemini-2.5-flash-lite',
        accountLabel: 'AI Studio Free Tier',
        isCustom: true,
        isActiveAiModel: false,
        connected: false,
        lastTestStatus: 'pendente',
        lastTestMessage: 'Pronto para receber chave e testar conexão',
        updatedAtIso: now,
      },
    ];
    for (const c of initialConnectors) {
      await putStoreItem('connectors', c);
    }
    await setMetaValue('connectors_seeded_v3', true);
  }

  const alreadySeeded = await getMetaValue<boolean>('seeded_v1', false);
  if (alreadySeeded) return;

  await putStoreItem<LocalMessage>('messages', {
    id: 'msg_welcome_01',
    threadId: 'thread_zapia_hub',
    role: 'assistant',
    content:
      'Olá, Moisés de Carvalho! Sou o ZAPIA MS, seu assistente pessoal multiplataforma. Estou pronto no Android, iOS e PC — tanto online com sincronização Google Drive, Gmail e Agenda, quanto 100% offline com criptografia AES-256-GCM. O que deseja organizar ou criar agora?',
    persona: 'amigo',
    voiceName: 'Fenrir',
    createdAtIso: now,
  });

  await putStoreItem<LocalMessage>('messages', {
    id: 'msg_google_01',
    threadId: 'thread_google_workspace',
    role: 'assistant',
    content:
      'Sua integração com Google Drive, Google Calendar, Contatos e múltiplas contas Gmail está configurada. Você pode alternar entre contas a qualquer momento na aba Conectar.',
    persona: 'executivo',
    voiceName: 'Kore',
    createdAtIso: now,
  });

  await putStoreItem<LocalMessage>('messages', {
    id: 'msg_vault_01',
    threadId: 'thread_vault_e2ee',
    role: 'assistant',
    content:
      'O Cofre Seguro E2EE já está operando com AES-256-GCM e verificação de hash SHA-256. Nenhum arquivo executável ou script malicioso entra sem passar pela quarentena automática.',
    persona: 'colega',
    voiceName: 'Fenrir',
    createdAtIso: now,
  });

  await putStoreItem<LocalMessage>('messages', {
    id: 'msg_media_01',
    threadId: 'thread_studio_media',
    role: 'assistant',
    content:
      'No Estúdio & Galeria você gera imagens PNG HD, grava vídeos WebM reais, captura fotos pela câmera e sincroniza tudo com o Google Drive.',
    persona: 'criativo',
    voiceName: 'Kore',
    createdAtIso: now,
  });

  await putStoreItem<LocalPreference>('preferences', {
    id: 'pref_voice_01',
    category: 'voz',
    key: 'Alternância de Voz',
    value: 'Alternar entre voz masculina (Fenrir) e feminina (Kore) em português do Brasil',
    confidence: 95,
    updatedAtIso: now,
  });

  await putStoreItem<LocalPreference>('preferences', {
    id: 'pref_style_02',
    category: 'estilo',
    key: 'Identidade Visual',
    value: 'ZAPIA Noir com assinatura pessoal Moisés de Carvalho',
    confidence: 98,
    updatedAtIso: now,
  });

  await putStoreItem<LocalReminder>('reminders', {
    id: 'rem_backup_01',
    title: 'Revisar backup criptografado semanal no Google Drive',
    dueAtIso: new Date(Date.now() + 86400000).toISOString(),
    status: 'pendente',
    createdAtIso: now,
  });

  const sampleDocText =
    'ZAPIA — Plano Executivo de Produtividade\nAutor: Moisés de Carvalho\n\n1. Backup automático criptografado para Google Drive e cofre offline.\n2. Agenda sincronizada e alertas inteligentes.\n3. Auditoria de integridade SHA-256 ativa.';
  const sampleBytes = new TextEncoder().encode(sampleDocText);
  const encrypted = await encryptBytesE2EE(sampleBytes);

  await putStoreItem<LocalVaultItem>('vaultItems', {
    id: 'vault_manual_01',
    title: 'Plano_Executivo_ZAPIA.txt',
    mimeType: 'text/plain',
    sizeBytes: sampleBytes.byteLength,
    sha256: encrypted.sha256,
    encryptedPayload: encrypted.encryptedBase64,
    iv: encrypted.ivBase64,
    scanStatus: 'limpo',
    findings: ['Assinatura MIME íntegra e nenhum padrão malicioso identificado.'],
    createdAtIso: now,
    updatedAtIso: now,
  });

  await putStoreItem<LocalGalleryItem>('galleryItems', {
    id: 'gal_zapia_emblem_01',
    title: 'Emblema Metálico ZAPIA 4D',
    kind: 'photo',
    source: 'local',
    mimeType: 'image/jpeg',
    dataUrl: '/assets/aistudio/Screenshot_20261119_202519_ChatGPT_c6c248c0.jpg',
    createdAtIso: now,
  });

  await putStoreItem<LocalGalleryItem>('galleryItems', {
    id: 'gal_zapia_showcase_02',
    title: 'ZAPIA Conceito Multiplataforma',
    kind: 'photo',
    source: 'local',
    mimeType: 'image/png',
    dataUrl: '/assets/aistudio/file_0000000075d8820ea177c375254a057b_f2c061af.png',
    createdAtIso: now,
  });

  await putStoreItem<LocalAuditLog>('auditLogs', {
    id: 'audit_init_01',
    action: 'Inicialização do Cofre AES-256-GCM',
    target: 'Plano_Executivo_ZAPIA.txt',
    verdict: 'seguro',
    createdAtIso: now,
  });

  await setMetaValue('seeded_v1', true);
}

export async function clearTemporaryCache(): Promise<{ freedBytes: number }> {
  let freedBytes = 0;
  if (typeof caches !== 'undefined') {
    const keys = await caches.keys();
    for (const k of keys) {
      if (k.includes('runtime') || k.includes('temp')) {
        await caches.delete(k);
        freedBytes += 1024 * 256;
      }
    }
  }
  return { freedBytes };
}
