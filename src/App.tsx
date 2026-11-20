import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Menu,
  ArrowLeft,
  WifiOff,
  FolderLock,
  Images,
  LogIn,
  Shield,
  Gamepad2,
} from 'lucide-react';
import { User } from 'firebase/auth';
import {
  DEFAULT_SETTINGS,
  LinkedAccountMeta,
  LocalAuditLog,
  LocalConnector,
  LocalDailyCheckin,
  LocalGalleryItem,
  LocalMessage,
  LocalPreference,
  LocalReminder,
  LocalSavedCardMeta,
  LocalThread,
  LocalVaultItem,
  ZapiaSettingsState,
  deleteStoreItem,
  getAllStoreItems,
  getMetaValue,
  putStoreItem,
  seedInitialOfflineDataIfEmpty,
  setMetaValue,
} from './utils/offlineDb';
import { decryptBytesE2EE, encryptBytesE2EE } from './utils/cryptoVault';
import {
  ZAPIA_THEMES,
  buildThreadTitleFromMessage,
  generateProactiveRadarCards,
  getThreadColorHex,
  processOfflineCommand,
  sanitizeFirestoreId,
  scanFileContent,
  selectNextVoice,
} from './utils/zapiaLogic';
import {
  CalendarEventSummary,
  ContactSummary,
  DriveFileSummary,
  GmailMessageSummary,
  createCalendarEvent,
  deleteSubcollectionDoc,
  ensureUserProfileInFirestore,
  fetchCalendarEvents,
  fetchDriveFiles,
  fetchGmailMessages,
  fetchGoogleContacts,
  getInMemoryAccessToken,
  initFirebaseAuth,
  sendGmailMessage,
  signInWithGoogleWorkspace,
  signOutWorkspace,
  subscribeUserVault,
  syncPreferenceToFirestore,
  syncReminderToFirestore,
  syncVaultItemToFirestore,
  testFirestoreConnection,
  uploadFileToDrive,
} from './services/firebaseService';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PWAInstallButton } from './components/PWAInstallButton';
import { AssistantView, SuggestedAction } from './components/AssistantView';
import { VaultView } from './components/VaultView';
import { GalleryView } from './components/GalleryView';
import { ScheduleMailView } from './components/ScheduleMailView';
import { SystemOptimizerView } from './components/SystemOptimizerView';
import { ZapiaDrawer, WorkspaceViewId } from './components/ZapiaDrawer';
import { ZapiaWordmark } from './components/ZapiaWordmark';
import { PersonaVoicePanel } from './components/PersonaVoicePanel';
import { ConnectorsView } from './components/ConnectorsView';
import { DevGameStudioView } from './components/DevGameStudioView';

export default function App() {
  const isOnline = useOnlineStatus();
  const [activeView, setActiveView] = useState<WorkspaceViewId>('assistant');
  const [artifactSubTab, setArtifactSubTab] = useState<'vault' | 'gallery' | 'code'>('vault');
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const [settings, setSettings] = useState<ZapiaSettingsState>(DEFAULT_SETTINGS);
  const [threads, setThreads] = useState<LocalThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [preferences, setPreferences] = useState<LocalPreference[]>([]);
  const [vaultItems, setVaultItems] = useState<LocalVaultItem[]>([]);
  const [galleryItems, setGalleryItems] = useState<LocalGalleryItem[]>([]);
  const [reminders, setReminders] = useState<LocalReminder[]>([]);
  const [auditLogs, setAuditLogs] = useState<LocalAuditLog[]>([]);
  const [accounts, setAccounts] = useState<LinkedAccountMeta[]>([]);
  const [connectors, setConnectors] = useState<LocalConnector[]>([]);
  const [dailyCheckins, setDailyCheckins] = useState<LocalDailyCheckin[]>([]);
  const [savedCards, setSavedCards] = useState<LocalSavedCardMeta[]>([]);

  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [driveFiles, setDriveFiles] = useState<DriveFileSummary[]>([]);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventSummary[]>([]);
  const [gmailMessages, setGmailMessages] = useState<GmailMessageSummary[]>([]);
  const [contacts, setContacts] = useState<ContactSummary[]>([]);
  const [isLoadingWorkspace, setIsLoadingWorkspace] = useState(false);

  const [isSendingChat, setIsSendingChat] = useState(false);
  const [suggestedActions, setSuggestedActions] = useState<SuggestedAction[]>([]);

  // Apply selected theme class & data attribute on documentElement
  useEffect(() => {
    const themeObj = ZAPIA_THEMES.find((t) => t.id === settings.themeId) || ZAPIA_THEMES[0];
    const html = document.documentElement;
    if (themeObj.isDark) {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
    html.setAttribute('data-theme', themeObj.id);
  }, [settings.themeId]);

  // Hydrate offline IndexedDB + seed data
  useEffect(() => {
    let mounted = true;
    (async () => {
      await seedInitialOfflineDataIfEmpty();
      const [
        savedSettings,
        savedThreads,
        savedMsgs,
        savedPrefs,
        savedVault,
        savedGallery,
        savedReminders,
        savedAudits,
        savedAccounts,
        savedConnectors,
        savedCheckins,
        savedCardsList,
      ] = await Promise.all([
        getMetaValue<ZapiaSettingsState>('settings_v1', DEFAULT_SETTINGS),
        getAllStoreItems<LocalThread>('threads'),
        getAllStoreItems<LocalMessage>('messages'),
        getAllStoreItems<LocalPreference>('preferences'),
        getAllStoreItems<LocalVaultItem>('vaultItems'),
        getAllStoreItems<LocalGalleryItem>('galleryItems'),
        getAllStoreItems<LocalReminder>('reminders'),
        getAllStoreItems<LocalAuditLog>('auditLogs'),
        getMetaValue<LinkedAccountMeta[]>('accounts_v1', []),
        getAllStoreItems<LocalConnector>('connectors'),
        getAllStoreItems<LocalDailyCheckin>('dailyCheckins'),
        getMetaValue<LocalSavedCardMeta[]>('saved_cards_v1', []),
      ]);
      if (!mounted) return;
      setSettings(savedSettings);
      setThreads(savedThreads.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)));
      setMessages(savedMsgs.sort((a, b) => a.createdAtIso.localeCompare(b.createdAtIso)));
      setPreferences(savedPrefs);
      setVaultItems(savedVault.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)));
      setGalleryItems(savedGallery.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)));
      setReminders(savedReminders.sort((a, b) => a.dueAtIso.localeCompare(b.dueAtIso)));
      setAuditLogs(savedAudits.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)));
      setAccounts(savedAccounts);
      setConnectors(savedConnectors.sort((a, b) => a.updatedAtIso.localeCompare(b.updatedAtIso)));
      setDailyCheckins(savedCheckins.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso)));
      setSavedCards(savedCardsList);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Test Firestore connection and observe Auth state
  useEffect(() => {
    testFirestoreConnection();
    const unsub = initFirebaseAuth(async (user, token) => {
      setFirebaseUser(user);
      setGoogleToken(token);
      if (user) {
        await ensureUserProfileInFirestore(user, {
          persona: settings.persona,
          voiceGender: settings.voiceGender,
          themeId: settings.themeId,
        }).catch(() => {});
      }
    });
    return () => unsub();
  }, []);

  // Live Firestore subscription when authenticated
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified) return;
    const unsub = subscribeUserVault(firebaseUser, async (cloudDocs) => {
      if (cloudDocs.length === 0) return;
      setVaultItems((prev) => {
        const merged = new Map<string, LocalVaultItem>();
        for (const item of prev) merged.set(item.id, item);
        for (const docItem of cloudDocs) {
          const id = String(docItem.id || '');
          if (id && !merged.has(id)) {
            merged.set(id, {
              id,
              title: String(docItem.title || 'Documento'),
              mimeType: String(docItem.mimeType || 'text/plain'),
              sizeBytes: Number(docItem.sizeBytes || 0),
              sha256: String(docItem.sha256 || '0'.repeat(64)),
              encryptedPayload: String(docItem.encryptedPayload || ''),
              iv: String(docItem.iv || ''),
              scanStatus: (docItem.scanStatus as LocalVaultItem['scanStatus']) || 'limpo',
              findings: ['Sincronizado via Firestore'],
              driveFileId: docItem.driveFileId ? String(docItem.driveFileId) : undefined,
              createdAtIso: String(docItem.createdAtIso || new Date().toISOString()),
              updatedAtIso: String(docItem.updatedAtIso || new Date().toISOString()),
            });
          }
        }
        return Array.from(merged.values()).sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
      });
    });
    return () => unsub();
  }, [firebaseUser]);

  const appendAudit = useCallback(async (action: string, target: string, verdict: LocalAuditLog['verdict']) => {
    const entry: LocalAuditLog = {
      id: `audit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      action,
      target,
      verdict,
      createdAtIso: new Date().toISOString(),
    };
    await putStoreItem('auditLogs', entry);
    setAuditLogs((prev) => [entry, ...prev].slice(0, 60));
  }, []);

  const handleUpdateSettings = async (patch: Partial<ZapiaSettingsState>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    await setMetaValue('settings_v1', next);
    if (firebaseUser) {
      ensureUserProfileInFirestore(firebaseUser, {
        persona: next.persona,
        voiceGender: next.voiceGender,
        themeId: next.themeId,
      }).catch(() => {});
    }
  };

  const refreshWorkspaceData = useCallback(
    async (tokenOverride?: string) => {
      const token = tokenOverride || googleToken || getInMemoryAccessToken(firebaseUser?.email);
      if (!token) return;
      setIsLoadingWorkspace(true);
      try {
        const [files, events, mails, people] = await Promise.all([
          fetchDriveFiles(token).catch(() => []),
          fetchCalendarEvents(token).catch(() => []),
          fetchGmailMessages(token).catch(() => []),
          fetchGoogleContacts(token).catch(() => []),
        ]);
        setDriveFiles(files);
        setCalendarEvents(events);
        setGmailMessages(mails);
        setContacts(people);
      } finally {
        setIsLoadingWorkspace(false);
      }
    },
    [googleToken, firebaseUser?.email]
  );

  const handleGoogleAccountAuth = async (loginHint?: string) => {
    const { user, accessToken } = await signInWithGoogleWorkspace(loginHint);
    setFirebaseUser(user);
    setGoogleToken(accessToken || null);
    if (user.email) {
      const nextAccounts = [
        {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || user.email,
          photoURL: user.photoURL || undefined,
          lastUsedIso: new Date().toISOString(),
        },
        ...accounts.filter((a) => a.email !== user.email),
      ];
      setAccounts(nextAccounts);
      await setMetaValue('accounts_v1', nextAccounts);
      await appendAudit('Login Google Workspace', user.email, 'seguro');
    }
    if (accessToken) {
      await refreshWorkspaceData(accessToken);
    }
  };

  const handleCreateVaultItem = async (
    title: string,
    mimeType: string,
    bytes: Uint8Array,
    textPreview?: string
  ) => {
    const scan = scanFileContent(title, mimeType, bytes, textPreview);
    const encrypted = await encryptBytesE2EE(bytes);
    const now = new Date().toISOString();
    const item: LocalVaultItem = {
      id: sanitizeFirestoreId(`vault_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`),
      title,
      mimeType,
      sizeBytes: bytes.byteLength,
      sha256: encrypted.sha256,
      encryptedPayload: encrypted.encryptedBase64,
      iv: encrypted.ivBase64,
      scanStatus: scan.status,
      findings: scan.findings,
      createdAtIso: now,
      updatedAtIso: now,
    };
    await putStoreItem('vaultItems', item);
    setVaultItems((prev) => [item, ...prev]);
    await appendAudit(
      `Varredura & Criptografia (${scan.status})`,
      title,
      scan.status === 'limpo' ? 'seguro' : scan.status === 'quarentena' ? 'bloqueado' : 'alerta'
    );

    if (firebaseUser && bytes.byteLength <= 170000) {
      await syncVaultItemToFirestore(firebaseUser, item).catch(() => {});
    }

    if (settings.autoBackupDrive && googleToken && scan.status !== 'quarentena') {
      uploadFileToDrive(googleToken, title, mimeType, bytes)
        .then(async (df) => {
          const updated = { ...item, driveFileId: df.id };
          await putStoreItem('vaultItems', updated);
          setVaultItems((prev) => prev.map((v) => (v.id === item.id ? updated : v)));
        })
        .catch(() => {});
    }
  };

  const handleUploadLocalFiles = async (fileList: FileList) => {
    for (const file of Array.from(fileList)) {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      const textPreview = file.type.startsWith('text/') ? new TextDecoder().decode(bytes.slice(0, 4000)) : undefined;
      await handleCreateVaultItem(file.name, file.type || 'application/octet-stream', bytes, textPreview);
    }
  };

  const handleAddPreference = async (
    category: LocalPreference['category'],
    key: string,
    value: string
  ) => {
    const pref: LocalPreference = {
      id: sanitizeFirestoreId(`pref_${Date.now()}`),
      category,
      key,
      value,
      confidence: 92,
      updatedAtIso: new Date().toISOString(),
    };
    await putStoreItem('preferences', pref);
    setPreferences((prev) => [pref, ...prev]);
    if (firebaseUser) {
      await syncPreferenceToFirestore(firebaseUser, pref).catch(() => {});
    }
  };

  const handleAddReminder = async (title: string, dueAtIso: string, syncCal: boolean) => {
    let calendarEventId: string | undefined;
    if (syncCal && googleToken) {
      try {
        const ev = await createCalendarEvent(googleToken, title, dueAtIso);
        calendarEventId = ev.id;
        setCalendarEvents((prev) => [ev, ...prev]);
      } catch {
        // Keep local reminder even if calendar sync fails
      }
    }
    const rem: LocalReminder = {
      id: sanitizeFirestoreId(`rem_${Date.now()}`),
      title,
      dueAtIso,
      status: 'pendente',
      calendarEventId,
      createdAtIso: new Date().toISOString(),
    };
    await putStoreItem('reminders', rem);
    setReminders((prev) => [...prev, rem].sort((a, b) => a.dueAtIso.localeCompare(b.dueAtIso)));
    if (firebaseUser) {
      await syncReminderToFirestore(firebaseUser, rem).catch(() => {});
    }
  };

  const handleSendMessage = async (text: string) => {
    const now = new Date().toISOString();
    let targetThreadId = activeThreadId;

    if (!targetThreadId) {
      const idx = threads.length;
      const newThread: LocalThread = {
        id: `thread_${Date.now()}`,
        title: buildThreadTitleFromMessage(text),
        colorHex: getThreadColorHex(idx),
        glyphVariant: idx % 4,
        unreadCount: 0,
        updatedAtIso: now,
      };
      targetThreadId = newThread.id;
      await putStoreItem('threads', newThread);
      setThreads((prev) => [newThread, ...prev]);
      setActiveThreadId(newThread.id);
    } else {
      const existing = threads.find((t) => t.id === targetThreadId);
      if (existing) {
        const updatedThread = { ...existing, updatedAtIso: now, unreadCount: 0 };
        await putStoreItem('threads', updatedThread);
        setThreads((prev) =>
          [updatedThread, ...prev.filter((t) => t.id !== targetThreadId)].sort((a, b) =>
            b.updatedAtIso.localeCompare(a.updatedAtIso)
          )
        );
      }
    }

    const threadMessages = messages.filter((m) => (m.threadId || 'thread_zapia_hub') === targetThreadId);

    const userMsg: LocalMessage = {
      id: `msg_u_${Date.now()}`,
      threadId: targetThreadId,
      role: 'user',
      content: text,
      persona: settings.persona,
      voiceName: 'Usuário',
      createdAtIso: now,
    };
    await putStoreItem('messages', userMsg);
    setMessages((prev) => [...prev, userMsg]);
    setIsSendingChat(true);

    const turnVoice = selectNextVoice(
      settings.voiceGender,
      threadMessages.length,
      settings.preferredMaleVoice,
      settings.preferredFemaleVoice
    );

    if (!isOnline) {
      const off = processOfflineCommand(text, settings.userName);
      if (off.actionType === 'reminder' && off.actionPayload) {
        await handleAddReminder(off.actionPayload, new Date(Date.now() + 3600000).toISOString(), false);
      } else if (off.actionType === 'vault_note' && off.actionPayload) {
        await handleCreateVaultItem(
          `Nota_Offline_${Date.now()}.txt`,
          'text/plain',
          new TextEncoder().encode(off.actionPayload),
          off.actionPayload
        );
      }
      const botMsg: LocalMessage = {
        id: `msg_a_${Date.now()}`,
        threadId: targetThreadId,
        role: 'assistant',
        content: off.reply,
        persona: settings.persona,
        voiceName: turnVoice.voiceName,
        createdAtIso: new Date().toISOString(),
      };
      await putStoreItem('messages', botMsg);
      setMessages((prev) => [...prev, botMsg]);
      setIsSendingChat(false);
      return;
    }

    try {
      const latestCheckin = dailyCheckins[0];
      const dailyCheckinSummary = latestCheckin
        ? `Humor: ${latestCheckin.mood} (energia ${latestCheckin.energy}/10), Foco: ${latestCheckin.focusGoal}, Reflexão: ${latestCheckin.reflection}`
        : undefined;

      const activeCustomConnector = connectors.find(
        (c) => c.isActiveAiModel && c.encryptedSecret && c.secretIv
      );

      let res: Response;
      if (activeCustomConnector && activeCustomConnector.encryptedSecret && activeCustomConnector.secretIv) {
        const plainSecret = new TextDecoder().decode(
          await decryptBytesE2EE(activeCustomConnector.encryptedSecret, activeCustomConnector.secretIv)
        );
        res = await fetch('/api/connectors/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            providerKind: activeCustomConnector.providerKind,
            baseUrl: activeCustomConnector.baseUrl,
            modelId: activeCustomConnector.modelId,
            secret: plainSecret,
            message: text,
            history: threadMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            persona: settings.persona,
            userName: settings.userName,
            dailyCheckinSummary,
          }),
        });
      } else {
        res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: text,
            history: threadMessages.slice(-6).map((m) => ({ role: m.role, content: m.content })),
            persona: settings.persona,
            toneStyle: `calor ${settings.warmth}%, velocidade ${settings.speed}%`,
            userName: settings.userName,
            preferences: preferences.map((p) => ({ category: p.category, key: p.key, value: p.value })),
            dailyCheckinSummary,
            contextSummary: `Arquivos no cofre: ${vaultItems.length}, Mídias na galeria: ${galleryItems.length}, Lembretes pendentes: ${reminders.filter((r) => r.status === 'pendente').length}, Conectores: ${connectors.length}.`,
          }),
        });
      }
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(err.error || 'Falha na comunicação com ZAPIA.');
      }
      const data = (await res.json()) as {
        reply: string;
        suggestedActions?: SuggestedAction[];
        learnedPreference?: { category: LocalPreference['category']; key: string; value: string } | null;
      };

      const botMsg: LocalMessage = {
        id: `msg_a_${Date.now()}`,
        threadId: targetThreadId,
        role: 'assistant',
        content: data.reply,
        persona: settings.persona,
        voiceName: turnVoice.voiceName,
        createdAtIso: new Date().toISOString(),
      };
      await putStoreItem('messages', botMsg);
      setMessages((prev) => [...prev, botMsg]);
      setSuggestedActions(data.suggestedActions || []);

      if (data.learnedPreference?.key && data.learnedPreference?.value) {
        await handleAddPreference(
          data.learnedPreference.category || 'rotina',
          data.learnedPreference.key,
          data.learnedPreference.value
        );
      }
    } catch (err: unknown) {
      const fallbackOff = processOfflineCommand(text, settings.userName);
      const errNote = err instanceof Error ? err.message : 'Serviço de IA indisponível.';
      const botMsg: LocalMessage = {
        id: `msg_a_${Date.now()}`,
        threadId: targetThreadId,
        role: 'assistant',
        content: `${fallbackOff.reply}\n\n(Aviso do servidor: ${errNote})`,
        persona: settings.persona,
        voiceName: turnVoice.voiceName,
        createdAtIso: new Date().toISOString(),
      };
      await putStoreItem('messages', botMsg);
      setMessages((prev) => [...prev, botMsg]);
    } finally {
      setIsSendingChat(false);
    }
  };

  const handleExecuteSuggestedAction = async (act: SuggestedAction) => {
    if (act.type === 'reminder' || act.type === 'calendar_event') {
      await handleAddReminder(act.payload || act.label, new Date(Date.now() + 3600000).toISOString(), !!googleToken);
      setActiveView('routines');
    } else if (act.type === 'vault_note') {
      const content = act.payload || act.label;
      await handleCreateVaultItem(
        `Nota_ZAPIA_${Date.now()}.txt`,
        'text/plain',
        new TextEncoder().encode(content),
        content
      );
      setArtifactSubTab('vault');
      setActiveView('artifacts');
    } else if (act.type === 'optimize') {
      setActiveView('radar');
    } else if (act.type === 'email_draft') {
      setActiveView('connect');
    }
  };

  const handleQuickOpenWorkspace = (
    target: 'vault' | 'gallery' | 'schedule' | 'system' | 'settings' | 'code'
  ) => {
    if (target === 'vault') {
      setArtifactSubTab('vault');
      setActiveView('artifacts');
    } else if (target === 'gallery') {
      setArtifactSubTab('gallery');
      setActiveView('artifacts');
    } else if (target === 'code') {
      setArtifactSubTab('code');
      setActiveView('artifacts');
    } else if (target === 'schedule') {
      setActiveView('routines');
    } else if (target === 'system') {
      setActiveView('radar');
    } else {
      setActiveView('settings');
    }
  };

  const handleSaveDailyCheckin = async (
    entry: Omit<LocalDailyCheckin, 'id' | 'dateIso' | 'createdAtIso'>
  ) => {
    const now = new Date().toISOString();
    const record: LocalDailyCheckin = {
      id: `checkin_${Date.now()}`,
      dateIso: now.slice(0, 10),
      ...entry,
      createdAtIso: now,
    };
    await putStoreItem('dailyCheckins', record);
    setDailyCheckins((prev) => [record, ...prev]);
    await appendAudit('Autoconhecimento diário registrado', `${entry.mood} (${entry.energy}/10)`, 'seguro');
  };

  const handleSelectThread = async (thread: LocalThread) => {
    if (thread.isMailAssistant) {
      setActiveView('connect');
      return;
    }
    setActiveThreadId(thread.id);
    setActiveView('assistant');
    setSuggestedActions([]);
    if (thread.unreadCount > 0) {
      const cleared = { ...thread, unreadCount: 0 };
      await putStoreItem('threads', cleared);
      setThreads((prev) => prev.map((t) => (t.id === thread.id ? cleared : t)));
    }
  };

  const handleNewChat = () => {
    setActiveThreadId(null);
    setActiveView('assistant');
    setSuggestedActions([]);
  };

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId) || null,
    [threads, activeThreadId]
  );

  const activeThreadMessages = useMemo(() => {
    if (!activeThreadId) return [];
    return messages.filter((m) => (m.threadId || 'thread_zapia_hub') === activeThreadId);
  }, [messages, activeThreadId]);

  const pendingReminders = useMemo(
    () => reminders.filter((r) => r.status === 'pendente'),
    [reminders]
  );

  const quarantinedCount = useMemo(
    () => vaultItems.filter((v) => v.scanStatus === 'quarentena').length,
    [vaultItems]
  );

  const radarCards = useMemo(
    () =>
      generateProactiveRadarCards({
        pendingRemindersCount: pendingReminders.length,
        nextReminderTitle: pendingReminders[0]?.title,
        vaultCount: vaultItems.length,
        quarantinedCount,
        hasGoogleConnected: !!firebaseUser,
        isOnline,
      }),
    [pendingReminders, vaultItems.length, quarantinedCount, firebaseUser, isOnline]
  );

  const totalThreadUnread = useMemo(
    () => threads.reduce((acc, t) => acc + (t.unreadCount || 0), 0),
    [threads]
  );

  const radarBadgeCount = Math.max(1, pendingReminders.length + quarantinedCount);

  return (
    <ErrorBoundary>
      <div className="min-h-screen flex bg-[var(--zapia-bg)] text-[var(--zapia-text)]">
        {/* Left Persistent Sidebar (Desktop) & Full-Screen Slide-Over Drawer (Mobile) — Screenshot 2 */}
        <ZapiaDrawer
          userName={settings.userName}
          userPhotoUrl={firebaseUser?.photoURL}
          userEmail={firebaseUser?.email}
          isOnline={isOnline}
          threads={threads}
          activeThreadId={activeThreadId}
          activeView={activeView}
          radarBadgeCount={radarBadgeCount}
          isMobileDrawerOpen={isMobileDrawerOpen}
          onCloseMobileDrawer={() => setIsMobileDrawerOpen(false)}
          onSelectThread={handleSelectThread}
          onNewChat={handleNewChat}
          onSelectView={(v) => setActiveView(v)}
        />

        {/* Right Primary Content Column */}
        <div className="flex-1 min-w-0 flex flex-col min-h-screen">
          {/* Top Bar (Screenshot 1 on Mobile: [≡ badge] — ZAPIA — [radar ring]) */}
          <header className="sticky top-0 z-30 h-14 px-4 sm:px-6 flex items-center justify-between gap-4 bg-[var(--zapia-bg)]/90 backdrop-blur-md no-print">
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setIsMobileDrawerOpen(true)}
                aria-label="Abrir menu ZAPIA e conversas"
                className="lg:hidden relative w-11 h-11 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center hover:border-[var(--zapia-accent)] transition-colors"
              >
                <Menu className="w-5 h-5" />
                {totalThreadUnread > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-white text-[#111113] text-[10px] font-bold flex items-center justify-center font-mono-tabular">
                    {totalThreadUnread}
                  </span>
                )}
              </button>

              {activeView !== 'assistant' && (
                <button
                  type="button"
                  onClick={() => setActiveView('assistant')}
                  className="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium hover:border-[var(--zapia-accent)] transition-colors"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Voltar ao Chat</span>
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={handleNewChat}
              aria-label="ZAPIA Início"
              className="flex items-center justify-center focus-visible:outline-none"
            >
              <ZapiaWordmark className="h-5 sm:h-6" />
            </button>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:flex items-center gap-2">
                <PWAInstallButton />
                {!firebaseUser ? (
                  <button
                    type="button"
                    onClick={() => handleGoogleAccountAuth()}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium hover:border-[var(--zapia-accent)] whitespace-nowrap min-h-[40px]"
                  >
                    <LogIn className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
                    <span>Conectar Gmail</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveView('connect')}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium max-w-[170px] min-h-[40px]"
                  >
                    <Shield className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    <span className="truncate">{firebaseUser.displayName || firebaseUser.email}</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => setActiveView(activeView === 'radar' ? 'assistant' : 'radar')}
                aria-label="Abrir Radar de alertas e sistema"
                className="relative w-11 h-11 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] flex items-center justify-center hover:border-[var(--zapia-accent)] transition-colors"
              >
                <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90" aria-hidden="true">
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="currentColor"
                    strokeOpacity="0.14"
                    strokeWidth="2.5"
                  />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    fill="none"
                    stroke="#EE966C"
                    strokeWidth="2.5"
                    strokeDasharray="88"
                    strokeDashoffset={Math.max(16, 88 - radarBadgeCount * 16)}
                    strokeLinecap="round"
                  />
                </svg>
                <span className="absolute text-xs font-bold font-mono-tabular">
                  {radarBadgeCount}
                </span>
              </button>
            </div>
          </header>

          {/* Main Active Content Area */}
          <main className="flex-1 flex flex-col">
            {activeView === 'assistant' && (
              <AssistantView
                activeThread={activeThread}
                messages={activeThreadMessages}
                preferences={preferences}
                radarCards={radarCards}
                settings={settings}
                isOnline={isOnline}
                isSending={isSendingChat}
                suggestedActions={suggestedActions}
                onUpdateSettings={handleUpdateSettings}
                onSendMessage={handleSendMessage}
                onExecuteSuggestedAction={handleExecuteSuggestedAction}
                onAddPreference={handleAddPreference}
                onDeletePreference={async (id) => {
                  await deleteStoreItem('preferences', id);
                  setPreferences((prev) => prev.filter((p) => p.id !== id));
                  if (firebaseUser) deleteSubcollectionDoc(firebaseUser, 'preferences', id).catch(() => {});
                }}
                onQuickOpenWorkspace={handleQuickOpenWorkspace}
                onNewChat={handleNewChat}
                activeCustomModelName={
                  connectors.find((c) => c.isActiveAiModel)?.name || null
                }
              />
            )}

            {activeView !== 'assistant' && (
              <div className="max-w-6xl w-full mx-auto px-4 sm:px-6 py-4 pb-10 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => setActiveView('assistant')}
                    className="lg:hidden inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)] text-xs font-medium"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Voltar ao ZAPIA</span>
                  </button>

                  {activeView === 'artifacts' && (
                    <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-full bg-[var(--zapia-surface)] border border-[var(--zapia-border)]">
                      <button
                        type="button"
                        onClick={() => setArtifactSubTab('vault')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                          artifactSubTab === 'vault'
                            ? 'bg-white text-[#111113]'
                            : 'text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                        }`}
                      >
                        <FolderLock className="w-3.5 h-3.5" />
                        <span>Cofre Seguro E2EE</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArtifactSubTab('gallery')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                          artifactSubTab === 'gallery'
                            ? 'bg-white text-[#111113]'
                            : 'text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                        }`}
                      >
                        <Images className="w-3.5 h-3.5" />
                        <span>Galeria & Estúdio HD</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setArtifactSubTab('code')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-colors ${
                          artifactSubTab === 'code'
                            ? 'bg-white text-[#111113]'
                            : 'text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                        }`}
                      >
                        <Gamepad2 className="w-3.5 h-3.5" />
                        <span>Apps, Jogos & Código</span>
                      </button>
                    </div>
                  )}
                </div>

                {activeView === 'connect' && (
                  <ConnectorsView
                    connectors={connectors}
                    savedCards={savedCards}
                    accounts={accounts}
                    activeEmail={firebaseUser?.email || null}
                    hasGoogleToken={!!googleToken}
                    onSaveConnector={async (record) => {
                      await putStoreItem('connectors', record);
                      const fresh = await getAllStoreItems<LocalConnector>('connectors');
                      setConnectors(fresh.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso)));
                      await appendAudit('Conector configurado', record.name, 'seguro');
                    }}
                    onDeleteConnector={async (id) => {
                      await deleteStoreItem('connectors', id);
                      setConnectors((prev) => prev.filter((c) => c.id !== id));
                    }}
                    onSetActiveAiConnector={async (activeId) => {
                      const allCurrent = await getAllStoreItems<LocalConnector>('connectors');
                      const updatedList: LocalConnector[] = [];
                      for (const c of allCurrent) {
                        const next = { ...c, isActiveAiModel: c.id === activeId };
                        await putStoreItem('connectors', next);
                        updatedList.push(next);
                      }
                      setConnectors(
                        updatedList.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso))
                      );
                    }}
                    onSaveCard={async (card) => {
                      const next = [card, ...savedCards];
                      setSavedCards(next);
                      await setMetaValue('saved_cards_v1', next);
                      await appendAudit('Cartão salvo (apenas 4 dígitos)', card.nickname, 'seguro');
                    }}
                    onDeleteCard={async (id) => {
                      const next = savedCards.filter((c) => c.id !== id);
                      setSavedCards(next);
                      await setMetaValue('saved_cards_v1', next);
                    }}
                    onAddGoogleAccount={(hint) => handleGoogleAccountAuth(hint)}
                    onOpenScheduleWorkspace={() => setActiveView('routines')}
                    onOpenCodeStudio={() => {
                      setArtifactSubTab('code');
                      setActiveView('artifacts');
                    }}
                  />
                )}

                {activeView === 'routines' && (
                  <ScheduleMailView
                    accounts={accounts}
                    activeEmail={firebaseUser?.email || null}
                    hasGoogleToken={!!googleToken}
                    reminders={reminders}
                    calendarEvents={calendarEvents}
                    gmailMessages={gmailMessages}
                    isLoadingWorkspace={isLoadingWorkspace}
                    onAddGoogleAccount={(hint) => handleGoogleAccountAuth(hint)}
                    onSwitchAccount={(email) => handleGoogleAccountAuth(email)}
                    onSignOut={async () => {
                      await signOutWorkspace();
                      setGoogleToken(null);
                      setDriveFiles([]);
                      setCalendarEvents([]);
                      setGmailMessages([]);
                    }}
                    onAddReminder={handleAddReminder}
                    onCompleteReminder={async (id) => {
                      const target = reminders.find((r) => r.id === id);
                      if (!target) return;
                      const updated: LocalReminder = { ...target, status: 'concluido' };
                      await putStoreItem('reminders', updated);
                      setReminders((prev) => prev.map((r) => (r.id === id ? updated : r)));
                      if (firebaseUser) {
                        await syncReminderToFirestore(firebaseUser, updated).catch(() => {});
                      }
                    }}
                    onDeleteReminder={async (id) => {
                      await deleteStoreItem('reminders', id);
                      setReminders((prev) => prev.filter((r) => r.id !== id));
                      if (firebaseUser) deleteSubcollectionDoc(firebaseUser, 'reminders', id).catch(() => {});
                    }}
                    onRefreshWorkspace={() => refreshWorkspaceData()}
                    onSendEmail={async (to, subject, body) => {
                      if (!googleToken) throw new Error('Conecte uma conta Gmail primeiro.');
                      await sendGmailMessage(googleToken, to, subject, body);
                      await appendAudit('E-mail enviado via Gmail', to, 'seguro');
                    }}
                  />
                )}

                {activeView === 'artifacts' && artifactSubTab === 'vault' && (
                  <VaultView
                    items={vaultItems}
                    driveFiles={driveFiles}
                    contacts={contacts}
                    hasGoogleToken={!!googleToken}
                    isLoadingDrive={isLoadingWorkspace}
                    onCreateNoteFile={async (title, content) => {
                      const bytes = new TextEncoder().encode(content);
                      await handleCreateVaultItem(title, 'text/plain', bytes, content);
                    }}
                    onUploadLocalFiles={handleUploadLocalFiles}
                    onUploadToDrive={async (item) => {
                      if (!googleToken) return;
                      const plainBytes = await decryptBytesE2EE(item.encryptedPayload, item.iv);
                      const df = await uploadFileToDrive(googleToken, item.title, item.mimeType, plainBytes);
                      const updated = { ...item, driveFileId: df.id };
                      await putStoreItem('vaultItems', updated);
                      setVaultItems((prev) => prev.map((v) => (v.id === item.id ? updated : v)));
                      setDriveFiles((prev) => [df, ...prev]);
                      await appendAudit('Backup Google Drive', item.title, 'seguro');
                    }}
                    onRefreshDrive={() => refreshWorkspaceData()}
                    onShareViaGmail={async (to, subject, body) => {
                      if (!googleToken) throw new Error('Conecte o Gmail primeiro.');
                      await sendGmailMessage(googleToken, to, subject, body);
                      await appendAudit('Compartilhamento Gmail', to, 'seguro');
                    }}
                    onDeleteItem={async (id) => {
                      await deleteStoreItem('vaultItems', id);
                      setVaultItems((prev) => prev.filter((v) => v.id !== id));
                      if (firebaseUser) deleteSubcollectionDoc(firebaseUser, 'vaultItems', id).catch(() => {});
                    }}
                    onRequestGoogleLogin={() => handleGoogleAccountAuth()}
                  />
                )}

                {activeView === 'artifacts' && artifactSubTab === 'gallery' && (
                  <GalleryView
                    items={galleryItems}
                    hasGoogleToken={!!googleToken}
                    userName={settings.userName}
                    onAddMediaItem={async (item) => {
                      await putStoreItem('galleryItems', item);
                      setGalleryItems((prev) => [item, ...prev]);
                      await appendAudit('Nova mídia na Galeria', item.title, 'seguro');
                    }}
                    onDeleteMediaItem={async (id) => {
                      await deleteStoreItem('galleryItems', id);
                      setGalleryItems((prev) => prev.filter((g) => g.id !== id));
                    }}
                    onSaveMediaToDrive={async (item) => {
                      if (!googleToken) return;
                      const res = await fetch(item.dataUrl);
                      const buf = await res.arrayBuffer();
                      const df = await uploadFileToDrive(googleToken, item.title, item.mimeType, new Uint8Array(buf));
                      const updated = { ...item, driveFileId: df.id, source: 'drive' as const };
                      await putStoreItem('galleryItems', updated);
                      setGalleryItems((prev) => prev.map((g) => (g.id === item.id ? updated : g)));
                      await appendAudit('Foto/Vídeo salvo no Google Drive', item.title, 'seguro');
                    }}
                    onSyncPhotosFromDrive={async () => {
                      if (!googleToken) return;
                      const files = await fetchDriveFiles(
                        googleToken,
                        "mimeType contains 'image/' or mimeType contains 'video/'"
                      );
                      for (const f of files.slice(0, 6)) {
                        if (f.thumbnailLink) {
                          const entry: LocalGalleryItem = {
                            id: `gal_drv_${f.id}`,
                            title: f.name,
                            kind: f.mimeType.startsWith('video/') ? 'video' : 'photo',
                            source: 'drive',
                            mimeType: f.mimeType,
                            dataUrl: f.thumbnailLink,
                            driveFileId: f.id,
                            createdAtIso: f.modifiedTime || new Date().toISOString(),
                          };
                          await putStoreItem('galleryItems', entry);
                          setGalleryItems((prev) => [entry, ...prev.filter((x) => x.id !== entry.id)]);
                        }
                      }
                    }}
                  />
                )}

                {activeView === 'artifacts' && artifactSubTab === 'code' && (
                  <DevGameStudioView
                    isOnline={isOnline}
                    onSaveToVault={async (title, mimeType, content) => {
                      await handleCreateVaultItem(
                        title,
                        mimeType,
                        new TextEncoder().encode(content),
                        content
                      );
                    }}
                    onAskZapiaInChat={async (prompt) => {
                      setActiveView('assistant');
                      await handleSendMessage(prompt);
                    }}
                  />
                )}

                {(activeView === 'radar' || activeView === 'settings') && (
                  <div className="space-y-6">
                    {activeView === 'settings' && (
                      <div className="space-y-4">
                        <h1 className="font-editorial text-2xl text-[var(--zapia-text)]">
                          Configurações de Voz, Personalidade e Sistema
                        </h1>
                        <PersonaVoicePanel
                          settings={settings}
                          preferences={preferences}
                          dailyCheckins={dailyCheckins}
                          isOnline={isOnline}
                          onUpdateSettings={handleUpdateSettings}
                          onAddPreference={handleAddPreference}
                          onDeletePreference={async (id) => {
                            await deleteStoreItem('preferences', id);
                            setPreferences((prev) => prev.filter((p) => p.id !== id));
                            if (firebaseUser) deleteSubcollectionDoc(firebaseUser, 'preferences', id).catch(() => {});
                          }}
                          onSaveDailyCheckin={handleSaveDailyCheckin}
                        />
                      </div>
                    )}

                    <SystemOptimizerView
                      settings={settings}
                      auditLogs={auditLogs}
                      vaultCount={vaultItems.length}
                      galleryCount={galleryItems.length}
                      onUpdateSettings={handleUpdateSettings}
                      onRunSecuritySweep={async () => {
                        for (const item of vaultItems) {
                          const plain = await decryptBytesE2EE(item.encryptedPayload, item.iv).catch(
                            () => new Uint8Array()
                          );
                          const scan = scanFileContent(item.title, item.mimeType, plain);
                          const updated = { ...item, scanStatus: scan.status, findings: scan.findings };
                          await putStoreItem('vaultItems', updated);
                        }
                        await appendAudit(
                          'Auditoria completa do sistema',
                          `${vaultItems.length} arquivos verificados`,
                          'seguro'
                        );
                      }}
                    />
                  </div>
                )}
              </div>
            )}
          </main>
        </div>

        {/* Offline Connectivity Toast */}
        {!isOnline && (
          <div className="fixed bottom-20 left-4 z-40 inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-amber-600 text-white text-xs font-medium shadow-lg no-print">
            <WifiOff className="w-4 h-4" />
            <span>Modo Offline — Dados locais criptografados ativos</span>
          </div>
        )}
      </div>
    </ErrorBoundary>
  );
}
