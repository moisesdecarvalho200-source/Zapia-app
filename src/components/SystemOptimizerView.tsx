import React, { useEffect, useState } from 'react';
import {
  Cpu,
  ShieldCheck,
  Palette,
  Battery,
  HardDrive,
  Sparkles,
  CheckCircle2,
  Trash2,
  CloudUpload,
  CalendarRange,
} from 'lucide-react';
import { ThemeId, WeeklySummaryReport, ZAPIA_THEMES } from '../utils/zapiaLogic';
import { LocalAuditLog, ZapiaSettingsState, clearTemporaryCache } from '../utils/offlineDb';

interface SystemOptimizerViewProps {
  settings: ZapiaSettingsState;
  auditLogs: LocalAuditLog[];
  vaultCount: number;
  galleryCount: number;
  weeklySummary?: WeeklySummaryReport;
  onUpdateSettings: (patch: Partial<ZapiaSettingsState>) => void;
  onRunSecuritySweep: () => Promise<void>;
}

interface DeviceDiagnostics {
  storageUsedMb: string;
  storageQuotaMb: string;
  batteryLevel: string;
  batteryCharging: string;
  cpuCores: number;
  memoryGb: string;
  networkType: string;
}

export const SystemOptimizerView: React.FC<SystemOptimizerViewProps> = ({
  settings,
  auditLogs,
  vaultCount,
  galleryCount,
  weeklySummary,
  onUpdateSettings,
  onRunSecuritySweep,
}) => {
  const [diag, setDiag] = useState<DeviceDiagnostics>({
    storageUsedMb: '0.0',
    storageQuotaMb: '0.0',
    batteryLevel: 'N/D',
    batteryCharging: 'Verificando',
    cpuCores: typeof navigator !== 'undefined' ? navigator.hardwareConcurrency || 4 : 4,
    memoryGb:
      typeof navigator !== 'undefined' && 'deviceMemory' in navigator
        ? `${(navigator as unknown as { deviceMemory?: number }).deviceMemory || 4} GB`
        : 'Auto',
    networkType:
      typeof navigator !== 'undefined' && 'connection' in navigator
        ? (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType || '4g'
        : 'Padrão',
  });
  const [optFeedback, setOptFeedback] = useState<string | null>(null);

  const refreshDiagnostics = async () => {
    let storageUsedMb = '0.0';
    let storageQuotaMb = '0.0';
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      storageUsedMb = ((est.usage || 0) / (1024 * 1024)).toFixed(2);
      storageQuotaMb = ((est.quota || 0) / (1024 * 1024)).toFixed(0);
    }

    let batteryLevel = 'Desktop / AC';
    let batteryCharging = 'Conectado';
    if (typeof navigator !== 'undefined' && 'getBattery' in navigator) {
      try {
        const bat = await (navigator as unknown as { getBattery: () => Promise<{ level: number; charging: boolean }> }).getBattery();
        batteryLevel = `${Math.round(bat.level * 100)}%`;
        batteryCharging = bat.charging ? 'Carregando' : 'Em bateria';
      } catch {
        // Ignore restricted battery API
      }
    }

    setDiag((prev) => ({
      ...prev,
      storageUsedMb,
      storageQuotaMb,
      batteryLevel,
      batteryCharging,
    }));
  };

  useEffect(() => {
    refreshDiagnostics();
  }, [vaultCount, galleryCount]);

  const handleOptimizeCache = async () => {
    const res = await clearTemporaryCache();
    await onRunSecuritySweep();
    await refreshDiagnostics();
    setOptFeedback(
      `Otimização concluída: cache temporário limpo (${(res.freedBytes / 1024).toFixed(0)} KB liberados) e auditoria SHA-256 executada em todos os arquivos.`
    );
  };

  const suggestDriveOnSensitive = settings.suggestDriveSyncOnSensitiveSave ?? true;

  return (
    <div className="space-y-6">
      {/* Google Drive & Vault E2EE Sync Preferences */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CloudUpload className="w-4 h-4 text-[var(--zapia-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
            Sincronização Google Drive & Dados Sensíveis
          </h2>
        </div>

        <div className="space-y-3">
          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold text-[var(--zapia-text)]">
                Sugerir sincronização para o Google Drive ao salvar dados sensíveis
              </div>
              <p className="text-xs text-[var(--zapia-muted)] leading-relaxed">
                Sempre que você salvar chaves de API, senhas, CPF ou documentos confidenciais no Cofre E2EE, o ZAPIA MS sugerirá enviar uma cópia protegida para seu Google Drive.
              </p>
            </div>
            <button
              id="toggle-suggest-drive-sensitive"
              data-testid="toggle-suggest-drive-sensitive"
              type="button"
              role="switch"
              aria-checked={suggestDriveOnSensitive}
              aria-label="Sugerir sincronização no Google Drive ao salvar dados sensíveis"
              onClick={() =>
                onUpdateSettings({
                  suggestDriveSyncOnSensitiveSave: !suggestDriveOnSensitive,
                })
              }
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                suggestDriveOnSensitive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)] border border-[var(--zapia-border)]'
              }`}
            >
              {suggestDriveOnSensitive ? 'Ativado' : 'Desativado'}
            </button>
          </div>

          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] flex items-center justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <div className="text-sm font-semibold text-[var(--zapia-text)]">
                Envio automático em segundo plano (Google Drive conectado)
              </div>
              <p className="text-xs text-[var(--zapia-muted)] leading-relaxed">
                Quando sua conta Google estiver conectada, replica automaticamente novos itens limpos do Cofre offline para o Google Drive.
              </p>
            </div>
            <button
              id="toggle-auto-backup-drive"
              data-testid="toggle-auto-backup-drive"
              type="button"
              role="switch"
              aria-checked={settings.autoBackupDrive}
              aria-label="Backup automático em segundo plano no Google Drive"
              onClick={() => onUpdateSettings({ autoBackupDrive: !settings.autoBackupDrive })}
              className={`px-3.5 py-2 rounded-full text-xs font-semibold transition-colors shrink-0 ${
                settings.autoBackupDrive
                  ? 'bg-emerald-600 text-white'
                  : 'bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)] border border-[var(--zapia-border)]'
              }`}
            >
              {settings.autoBackupDrive ? 'Ativado' : 'Manual'}
            </button>
          </div>
        </div>
      </section>

      {weeklySummary && (
        <section
          data-testid="radar-weekly-summary"
          className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarRange className="w-4 h-4 text-[var(--zapia-accent)]" />
              <h3 className="text-base font-semibold text-[var(--zapia-text)]">
                Resumo Semanal ZAPIA MS ({weeklySummary.periodLabel})
              </h3>
            </div>
            <span
              className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                weeklySummary.overallSentiment.polarity === 'positivo'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : weeklySummary.overallSentiment.polarity === 'negativo'
                    ? 'bg-rose-500/15 text-rose-400'
                    : weeklySummary.overallSentiment.polarity === 'misto'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)]'
              }`}
            >
              Sentimento: {weeklySummary.overallSentiment.label}
            </span>
          </div>
          <ul className="space-y-1.5 text-xs text-[var(--zapia-muted)]">
            {weeklySummary.highlights.map((h, i) => (
              <li key={i} className="leading-relaxed">
                • {h}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Theme & Color Switcher */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-[var(--zapia-accent)]" />
          <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
            Troca de Cores & Estilo Pessoal
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ZAPIA_THEMES.map((theme) => {
            const active = settings.themeId === theme.id;
            return (
              <button
                key={theme.id}
                type="button"
                onClick={() => onUpdateSettings({ themeId: theme.id as ThemeId })}
                className={`p-4 rounded-xl border text-left transition-all ${
                  active
                    ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)]'
                    : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)] hover:border-[var(--zapia-accent)]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className="w-5 h-5 rounded-md border border-white/20"
                    style={{ backgroundColor: theme.swatchHex }}
                    aria-hidden="true"
                  />
                  {active && <CheckCircle2 className="w-4 h-4 text-[var(--zapia-accent)]" />}
                </div>
                <div className="text-sm font-semibold text-[var(--zapia-text)]">{theme.name}</div>
                <p className="text-xs text-[var(--zapia-muted)] mt-1">{theme.description}</p>
              </button>
            );
          })}
        </div>

        <div className="pt-3 border-t border-[var(--zapia-border)] flex flex-wrap items-center justify-between gap-4">
          <div className="flex-1 min-w-[220px]">
            <label htmlFor="owner-name-input" className="block text-xs text-[var(--zapia-muted)] mb-1">
              Nome / Assinatura do Titular
            </label>
            <input
              id="owner-name-input"
              type="text"
              value={settings.userName}
              onChange={(e) => onUpdateSettings({ userName: e.target.value })}
              className="w-full max-w-sm px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
            />
          </div>
          <div className="text-xs text-[var(--zapia-muted)]">
            Desenvolvido no padrão pessoal de <strong className="text-[var(--zapia-text)]">{settings.userName || 'Moisés de Carvalho'}</strong>
          </div>
        </div>
      </section>

      {/* Real Device Performance & Battery Optimizer */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-[var(--zapia-accent)]" />
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Otimizador Inteligente de Desempenho & Bateria
            </h3>
          </div>
          <button
            type="button"
            onClick={handleOptimizeCache}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90"
          >
            <Sparkles className="w-4 h-4" />
            <span>Otimizar e Auditar Agora</span>
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="device-metrics">
          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)]">
            <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)]">
              <HardDrive className="w-3.5 h-3.5" />
              <span>Armazenamento Local</span>
            </div>
            <div className="text-xl font-bold font-mono-tabular text-[var(--zapia-text)] mt-1">
              {diag.storageUsedMb} MB
            </div>
            <div className="text-xs text-[var(--zapia-muted)] font-mono-tabular">
              Cota: {diag.storageQuotaMb} MB
            </div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)]">
            <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)]">
              <Battery className="w-3.5 h-3.5" />
              <span>Energia do Aparelho</span>
            </div>
            <div className="text-xl font-bold font-mono-tabular text-[var(--zapia-text)] mt-1">
              {diag.batteryLevel}
            </div>
            <div className="text-xs text-[var(--zapia-muted)]">{diag.batteryCharging}</div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)]">
            <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)]">
              <Cpu className="w-3.5 h-3.5" />
              <span>Núcleos & Memória</span>
            </div>
            <div className="text-xl font-bold font-mono-tabular text-[var(--zapia-text)] mt-1">
              {diag.cpuCores} Threads
            </div>
            <div className="text-xs text-[var(--zapia-muted)]">RAM: {diag.memoryGb}</div>
          </div>

          <div className="p-4 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)]">
            <div className="flex items-center gap-2 text-xs text-[var(--zapia-muted)]">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Dados Protegidos</span>
            </div>
            <div className="text-xl font-bold font-mono-tabular text-[var(--zapia-text)] mt-1">
              {vaultCount + galleryCount} itens
            </div>
            <div className="text-xs text-[var(--zapia-muted)]">Rede: {diag.networkType}</div>
          </div>
        </div>

        {optFeedback && (
          <div className="p-3 rounded-xl border border-emerald-600/30 bg-emerald-500/10 text-xs font-medium text-emerald-700 dark:text-emerald-400" role="status">
            {optFeedback}
          </div>
        )}
      </section>

      {/* Immutable Security & Antivirus Audit Log */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Monitoramento Antimalware & Auditoria de Integridade
            </h3>
          </div>
          <span className="text-xs font-mono-tabular text-[var(--zapia-muted)]">
            {auditLogs.length} eventos
          </span>
        </div>

        <div className="divide-y divide-[var(--zapia-border)] max-h-64 overflow-y-auto">
          {auditLogs.map((log) => (
            <div key={log.id} className="py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div>
                <span className="font-semibold text-[var(--zapia-text)]">{log.action}</span>
                <span className="text-[var(--zapia-muted)]"> · {log.target}</span>
              </div>
              <div className="flex items-center gap-3 font-mono-tabular">
                <span className={log.verdict === 'seguro' ? 'text-emerald-500' : 'text-amber-500'}>
                  {log.verdict.toUpperCase()}
                </span>
                <span className="text-[var(--zapia-muted)]">
                  {new Date(log.createdAtIso).toLocaleTimeString('pt-BR')}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="pt-2 flex items-center justify-between text-xs text-[var(--zapia-muted)] border-t border-[var(--zapia-border)]">
          <span>ZAPIA MS Assistente Inteligente · Assinado por Moisés de Carvalho</span>
          <button
            type="button"
            onClick={async () => {
              await clearTemporaryCache();
              setOptFeedback('Caches temporários limpos sem afetar seus arquivos criptografados.');
            }}
            className="inline-flex items-center gap-1.5 text-xs text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Limpar Cache Temporário</span>
          </button>
        </div>
      </section>
    </div>
  );
};
