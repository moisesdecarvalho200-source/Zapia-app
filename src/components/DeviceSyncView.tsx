import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Eye,
  EyeOff,
  FileKey2,
  Globe,
  HardDriveUpload,
  KeyRound,
  Laptop,
  Loader2,
  Lock,
  LogIn,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  DeviceE2EEStatus,
  DevicePlatform,
  DeviceSessionRecord,
  EncryptedExportEnvelope,
  validateExportPassphrase,
} from '../utils/zapiaLogic';
import { LocalConnector } from '../utils/offlineDb';

interface DeviceSyncViewProps {
  devices: DeviceSessionRecord[];
  currentDeviceId: string;
  currentFingerprint: string;
  userEmail: string | null;
  userName: string;
  isOnline: boolean;
  isSyncing: boolean;
  lastGlobalSyncIso: string | null;
  connectors: LocalConnector[];
  vaultCount: number;
  galleryCount: number;
  remindersCount: number;
  preferencesCount: number;
  onForceSync: (targetDeviceId?: string) => Promise<void>;
  onRenameCurrentDevice: (newName: string) => Promise<void>;
  onRemoveDevice: (deviceId: string) => Promise<void>;
  onRequestGoogleLogin: () => Promise<void>;
  onExportEncryptedBackup: (passphrase: string) => Promise<EncryptedExportEnvelope>;
  onImportEncryptedBackup: (
    rawJson: string,
    passphrase: string
  ) => Promise<{
    restoredCounts: {
      vault: number;
      reminders: number;
      preferences: number;
      connectors: number;
      gallery: number;
    };
    exportedAtIso: string;
    sourceDeviceId: string;
  }>;
  onOpenConnectorQuick: (catalogId: string) => void;
}

function renderPlatformIcon(platform: DevicePlatform) {
  if (platform === 'android' || platform === 'ios') {
    return <Smartphone className="w-5 h-5" />;
  }
  if (platform === 'windows' || platform === 'macos' || platform === 'linux') {
    return <Laptop className="w-5 h-5" />;
  }
  return <Globe className="w-5 h-5" />;
}

function getStatusBadge(status: DeviceE2EEStatus) {
  switch (status) {
    case 'sincronizado':
      return {
        label: 'Sincronizado E2EE',
        className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        icon: <ShieldCheck className="w-3.5 h-3.5" />,
      };
    case 'sincronizando':
      return {
        label: 'Sincronizando...',
        className: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
        icon: <RefreshCw className="w-3.5 h-3.5 animate-spin" />,
      };
    case 'chave_divergente':
      return {
        label: 'Chave Divergente',
        className: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        icon: <ShieldAlert className="w-3.5 h-3.5" />,
      };
    default:
      return {
        label: 'Pendente Offline',
        className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        icon: <AlertTriangle className="w-3.5 h-3.5" />,
      };
  }
}

function formatDateTimePtBr(iso?: string | null): string {
  if (!iso) return 'Ainda não sincronizado na nuvem';
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const DeviceSyncView: React.FC<DeviceSyncViewProps> = ({
  devices,
  currentDeviceId,
  currentFingerprint,
  userEmail,
  userName,
  isOnline,
  isSyncing,
  lastGlobalSyncIso,
  connectors,
  vaultCount,
  galleryCount,
  remindersCount,
  preferencesCount,
  onForceSync,
  onRenameCurrentDevice,
  onRemoveDevice,
  onRequestGoogleLogin,
  onExportEncryptedBackup,
  onImportEncryptedBackup,
  onOpenConnectorQuick,
}) => {
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const [exportPassphrase, setExportPassphrase] = useState('');
  const [showExportPass, setShowExportPass] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const [lastExportReceipt, setLastExportReceipt] = useState<EncryptedExportEnvelope | null>(null);

  const [importPassphrase, setImportPassphrase] = useState('');
  const [selectedBackupFileName, setSelectedBackupFileName] = useState('');
  const [selectedBackupRaw, setSelectedBackupRaw] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [importFeedback, setImportFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const passValidation = validateExportPassphrase(exportPassphrase);

  const handleGlobalForceSync = async (targetId?: string) => {
    setSyncNotice(null);
    await onForceSync(targetId);
    setSyncNotice(
      userEmail
        ? `Sincronização E2EE concluída às ${formatDateTimePtBr(new Date().toISOString())}.`
        : `Estado E2EE local verificado (${vaultCount} itens do cofre, ${remindersCount} lembretes). Conecte sua conta Google para espelhar entre aparelhos.`
    );
  };

  const handleExportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setExportError(null);
    if (!passValidation.valid) {
      setExportError(passValidation.reason || 'Informe uma senha com 8 ou mais caracteres.');
      return;
    }
    setIsExporting(true);
    try {
      const envelope = await onExportEncryptedBackup(exportPassphrase);
      setLastExportReceipt(envelope);
      setExportPassphrase('');
    } catch (err: unknown) {
      setExportError(err instanceof Error ? err.message : 'Falha ao exportar backup seguro.');
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackupFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedBackupFileName(file.name);
    const text = await file.text();
    setSelectedBackupRaw(text);
    setImportFeedback(null);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBackupRaw) {
      setImportFeedback({ ok: false, message: 'Selecione primeiro um arquivo .zapia-e2ee.json.' });
      return;
    }
    if (!importPassphrase.trim()) {
      setImportFeedback({ ok: false, message: 'Digite a senha usada na exportação do backup.' });
      return;
    }
    setIsImporting(true);
    setImportFeedback(null);
    try {
      const res = await onImportEncryptedBackup(selectedBackupRaw, importPassphrase);
      setImportFeedback({
        ok: true,
        message: `Backup íntegro restaurado (${res.restoredCounts.vault} documentos do cofre, ${res.restoredCounts.reminders} lembretes, ${res.restoredCounts.connectors} conectores, ${res.restoredCounts.gallery} mídias).`,
      });
      setImportPassphrase('');
    } catch (err: unknown) {
      setImportFeedback({
        ok: false,
        message: err instanceof Error ? err.message : 'Senha incorreta ou arquivo inválido.',
      });
    } finally {
      setIsImporting(false);
    }
  };

  const quickAiMediaLinks = [
    { id: 'openai_gpt', label: 'ChatGPT (GPT)', glyph: 'GPT', color: '#10A37F' },
    { id: 'google_gemini', label: 'Google Gemini', glyph: 'GM', color: '#1A73E8' },
    { id: 'dola_ai', label: 'Dola AI', glyph: 'DL', color: '#5B6CFF' },
    { id: 'suno_ai', label: 'Suno Música', glyph: 'SN', color: '#EA580C' },
    { id: 'pollinations_media', label: 'Pollinations IA', glyph: 'PL', color: '#7C3AED' },
    { id: 'pexels_media', label: 'Pexels HD', glyph: 'PX', color: '#05A081' },
    { id: 'pixabay_media', label: 'Pixabay HD', glyph: 'PB', color: '#2EC66D' },
    { id: 'unsplash_media', label: 'Unsplash HD', glyph: 'US', color: '#111111' },
  ];

  const syncedCount = devices.filter((d) => d.e2eeStatus === 'sincronizado').length;

  return (
    <div className="max-w-4xl mx-auto w-full space-y-6">
      {/* Header & Global Manual Force Sync CTA */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2 text-xs font-medium text-emerald-400">
            <Lock className="w-3.5 h-3.5 shrink-0" />
            <span>Criptografia Ponta a Ponta (AES-256-GCM + SHA-256)</span>
          </div>
          <h1 className="font-editorial text-2xl sm:text-3xl text-[var(--zapia-text)]">
            Sincronização de Dispositivos
          </h1>
          <p className="text-xs sm:text-sm text-[var(--zapia-muted)]">
            Acompanhe os aparelhos conectados na conta de {userName}, compare impressões digitais E2EE e force a sincronização quando precisar.
          </p>
        </div>

        <button
          type="button"
          disabled={isSyncing}
          onClick={() => handleGlobalForceSync()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-white text-[#111113] text-xs font-semibold hover:bg-neutral-200 transition-colors disabled:opacity-60 shrink-0"
        >
          {isSyncing ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          <span>{isSyncing ? 'Sincronizando...' : 'Forçar Sincronização Manual'}</span>
        </button>
      </div>

      {/* Account & E2EE Summary Card */}
      <section className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <div className="text-xs text-[var(--zapia-muted)]">Conta E2EE ativa</div>
            <div className="text-sm font-semibold text-[var(--zapia-text)] break-words">
              {userEmail || 'Sessão Local (sem conta Google)'}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--zapia-muted)]">
              <span>Dispositivos listados: {devices.length}</span>
              <span>·</span>
              <span>Sincronizados: {syncedCount}</span>
              <span>·</span>
              <span>Última verificação: {formatDateTimePtBr(lastGlobalSyncIso)}</span>
            </div>
          </div>

          {!userEmail && (
            <button
              type="button"
              onClick={() => onRequestGoogleLogin()}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
            >
              <LogIn className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
              <span>Entrar com Google para Sincronizar Outros Aparelhos</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
          <div className="rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] p-3">
            <div className="text-[11px] text-[var(--zapia-muted)]">Chave E2EE Local</div>
            <div className="text-[11px] sm:text-xs font-mono-tabular font-semibold text-emerald-400 mt-1 break-all">
              {currentFingerprint}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] p-3">
            <div className="text-[11px] text-[var(--zapia-muted)]">Itens no Cofre</div>
            <div className="text-sm font-mono-tabular font-semibold text-[var(--zapia-text)] mt-1">
              {vaultCount} criptografado(s)
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] p-3">
            <div className="text-[11px] text-[var(--zapia-muted)]">Lembretes & Memórias</div>
            <div className="text-sm font-mono-tabular font-semibold text-[var(--zapia-text)] mt-1">
              {remindersCount} · {preferencesCount}
            </div>
          </div>
          <div className="rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] p-3">
            <div className="text-[11px] text-[var(--zapia-muted)]">Conectores & Rede</div>
            <div className="text-sm font-mono-tabular font-semibold text-[var(--zapia-text)] mt-1">
              {connectors.length} · {isOnline ? 'Online' : 'Offline'}
            </div>
          </div>
        </div>

        {syncNotice && (
          <div
            role="status"
            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2.5 text-xs text-emerald-300 flex items-center gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{syncNotice}</span>
          </div>
        )}
      </section>

      {/* Devices List */}
      <section aria-label="Dispositivos logados na conta" className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[var(--zapia-text)]">
            Dispositivos Logados na Mesma Conta
          </h2>
          <span className="text-xs text-[var(--zapia-muted)] font-mono-tabular">
            ID atual: {currentDeviceId}
          </span>
        </div>

        <div className="space-y-3">
          {devices.map((device) => {
            const isCurrent = device.isCurrentDevice || device.id === currentDeviceId;
            const badge = getStatusBadge(device.e2eeStatus);
            const matchesFingerprint = device.e2eeFingerprint === currentFingerprint;

            return (
              <div
                key={device.id}
                data-testid={`device-card-${device.id}`}
                className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-4 sm:p-5 space-y-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3.5 min-w-0">
                    <div className="w-11 h-11 rounded-2xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] flex items-center justify-center text-[var(--zapia-text)] shrink-0">
                      {renderPlatformIcon(device.platform)}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        {isCurrent && editingName ? (
                          <form
                            onSubmit={async (e) => {
                              e.preventDefault();
                              if (draftName.trim()) {
                                await onRenameCurrentDevice(draftName.trim());
                              }
                              setEditingName(false);
                            }}
                            className="flex items-center gap-2"
                          >
                            <input
                              type="text"
                              value={draftName}
                              onChange={(e) => setDraftName(e.target.value)}
                              aria-label="Nome deste dispositivo"
                              className="px-2.5 py-1 rounded-lg bg-[var(--zapia-bg)] border border-[var(--zapia-border)] text-xs text-[var(--zapia-text)]"
                            />
                            <button
                              type="submit"
                              className="px-2.5 py-1 rounded-full bg-white text-[#111113] text-[11px] font-semibold"
                            >
                              Salvar
                            </button>
                          </form>
                        ) : (
                          <h3 className="text-sm sm:text-base font-semibold text-[var(--zapia-text)] truncate">
                            {device.deviceName}
                          </h3>
                        )}
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full bg-white/10 text-[var(--zapia-text)] text-[11px] font-medium">
                            Este dispositivo
                          </span>
                        )}
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border text-[11px] font-medium ${badge.className}`}
                        >
                          {badge.icon}
                          <span>{badge.label}</span>
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--zapia-muted)]">
                        <span className="font-mono-tabular">
                          Chave E2EE: <strong className="text-[var(--zapia-text)]">{device.e2eeFingerprint}</strong>
                        </span>
                        <span>·</span>
                        <span>
                          {matchesFingerprint
                            ? 'Assinatura compatível'
                            : 'Exige importação do backup E2EE para alinhar chave'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {isCurrent && !editingName && (
                      <button
                        type="button"
                        onClick={() => {
                          setDraftName(device.deviceName);
                          setEditingName(true);
                        }}
                        className="px-3 py-1.5 rounded-full border border-[var(--zapia-border)] text-xs text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]"
                      >
                        Renomear
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => handleGlobalForceSync(device.id)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>Forçar Sincronização</span>
                    </button>

                    {!isCurrent && (
                      <button
                        type="button"
                        aria-label={`Remover dispositivo ${device.deviceName}`}
                        onClick={() => onRemoveDevice(device.id)}
                        className="p-2 rounded-full border border-[var(--zapia-border)] text-rose-400 hover:bg-rose-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[var(--zapia-border)] text-[11px] text-[var(--zapia-muted)]">
                  <span>
                    Cofre: {device.syncedVaultCount} · Lembretes: {device.syncedRemindersCount} · Preferências: {device.syncedPreferencesCount}
                  </span>
                  <span className="font-mono-tabular">
                    Último sync: {formatDateTimePtBr(device.lastSyncIso)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Secure Export & Restore E2EE Section */}
      <section
        aria-label="Exportação Segura E2EE"
        className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-5"
      >
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shrink-0">
            <FileKey2 className="w-5 h-5" />
          </div>
          <div className="space-y-1 min-w-0">
            <h2 className="font-editorial text-xl text-[var(--zapia-text)]">
              Exportação Segura (Backup Criptografado E2EE)
            </h2>
            <p className="text-xs sm:text-sm text-[var(--zapia-muted)]">
              Exporte cofre, configurações de voz treinada, lembretes, galeria e conectores protegidos por PBKDF2-SHA256 (120.000 iterações) + AES-256-GCM. Somente quem possui sua senha consegue abrir o arquivo em outro dispositivo.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Export Form */}
          <form
            onSubmit={handleExportSubmit}
            className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-4 space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[var(--zapia-text)]">
                1. Gerar pacote criptografado
              </span>
              {exportPassphrase && (
                <span
                  className={`text-[11px] font-medium ${
                    passValidation.strength === 'forte'
                      ? 'text-emerald-400'
                      : passValidation.strength === 'media'
                        ? 'text-amber-400'
                        : 'text-rose-400'
                  }`}
                >
                  Força: {passValidation.strength}
                </span>
              )}
            </div>

            <div className="relative">
              <label htmlFor="export-passphrase" className="sr-only">
                Senha mestre para exportação segura
              </label>
              <input
                id="export-passphrase"
                type={showExportPass ? 'text' : 'password'}
                value={exportPassphrase}
                onChange={(e) => {
                  setExportPassphrase(e.target.value);
                  setExportError(null);
                }}
                placeholder="Crie uma senha forte (mín. 8 caracteres)"
                className="w-full pr-10 pl-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs sm:text-sm text-[var(--zapia-text)]"
              />
              <button
                type="button"
                aria-label={showExportPass ? 'Ocultar senha' : 'Mostrar senha'}
                onClick={() => setShowExportPass((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]"
              >
                {showExportPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {exportError && (
              <div role="alert" className="text-xs text-rose-400 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isExporting}
              className="w-full py-2.5 px-4 rounded-full bg-white text-[#111113] text-xs font-semibold inline-flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors"
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              <span>Exportar Backup Seguro (.zapia-e2ee.json)</span>
            </button>

            {lastExportReceipt && (
              <div
                role="status"
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-[11px] text-emerald-300 space-y-1"
              >
                <div className="font-semibold flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>Backup E2EE exportado com sucesso</span>
                </div>
                <div className="font-mono-tabular break-all opacity-90">
                  SHA-256: {lastExportReceipt.payloadSha256.slice(0, 32)}...
                </div>
                <div>
                  Itens protegidos: {lastExportReceipt.summary.vaultCount} cofre ·{' '}
                  {lastExportReceipt.summary.galleryCount} galeria ·{' '}
                  {lastExportReceipt.summary.connectorsCount} conectores
                </div>
              </div>
            )}
          </form>

          {/* Restore Form */}
          <form
            onSubmit={handleImportSubmit}
            className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] p-4 space-y-3"
          >
            <div className="text-xs font-semibold text-[var(--zapia-text)]">
              2. Restaurar ou verificar backup de outro aparelho
            </div>

            <input
              ref={importInputRef}
              type="file"
              accept=".json,.zapia-e2ee.json,application/json"
              onChange={handleBackupFileSelected}
              className="hidden"
            />

            <button
              type="button"
              onClick={() => importInputRef.current?.click()}
              className="w-full py-2.5 px-3.5 rounded-xl border border-dashed border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] flex items-center justify-center gap-2"
            >
              <HardDriveUpload className="w-4 h-4 text-[var(--zapia-accent)]" />
              <span className="truncate">
                {selectedBackupFileName || 'Selecionar arquivo .zapia-e2ee.json'}
              </span>
            </button>

            <div>
              <label htmlFor="import-passphrase" className="sr-only">
                Senha do arquivo de backup
              </label>
              <input
                id="import-passphrase"
                type="password"
                value={importPassphrase}
                onChange={(e) => setImportPassphrase(e.target.value)}
                placeholder="Senha usada ao exportar o backup"
                className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs sm:text-sm text-[var(--zapia-text)]"
              />
            </div>

            {importFeedback && (
              <div
                role="status"
                className={`rounded-xl border p-2.5 text-xs flex items-start gap-2 ${
                  importFeedback.ok
                    ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                    : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
                }`}
              >
                <KeyRound className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span>{importFeedback.message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isImporting}
              className="w-full py-2.5 px-4 rounded-full border border-[var(--zapia-border)] bg-[var(--zapia-surface)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)] inline-flex items-center justify-center gap-2"
            >
              {isImporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
              )}
              <span>Descriptografar e Restaurar Backup</span>
            </button>
          </form>
        </div>
      </section>

      {/* Quick Connections to GPT, Gemini, Dola, Suno & Free Photos/Videos */}
      <section className="rounded-3xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-editorial text-lg text-[var(--zapia-text)]">
              Conectar GPT, Gemini, Dola, Suno e Fotos/Vídeos Grátis
            </h2>
            <p className="text-xs text-[var(--zapia-muted)]">
              O motor Gemini nativo do servidor ZAPIA já está ativo. Conecte também sua conta OpenAI GPT, chave própria Gemini, Dola AI, Suno ou APIs gratuitas de fotos e vídeos.
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-[11px] font-medium">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Gemini ZAPIA Ativo</span>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {quickAiMediaLinks.map((item) => {
            const existing = connectors.find((c) => c.catalogId === item.id);
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onOpenConnectorQuick(item.id)}
                className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] hover:border-[var(--zapia-accent)] p-3 text-left flex items-center gap-2.5 transition-colors"
              >
                <span
                  className="w-9 h-9 rounded-xl flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                  style={{ backgroundColor: item.color }}
                >
                  {item.glyph}
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">
                    {item.label}
                  </div>
                  <div className="text-[10px] text-[var(--zapia-muted)] truncate">
                    {existing?.connected ? 'Conectado' : 'Conectar agora'}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
};
