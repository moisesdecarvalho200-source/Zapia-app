import React, { useState } from 'react';
import {
  Calendar,
  Mail,
  Bell,
  Plus,
  CheckCircle2,
  Trash2,
  UserPlus,
  Send,
  RefreshCw,
} from 'lucide-react';
import { LinkedAccountMeta, LocalReminder } from '../utils/offlineDb';
import { CalendarEventSummary, GmailMessageSummary } from '../services/firebaseService';

interface ScheduleMailViewProps {
  accounts: LinkedAccountMeta[];
  activeEmail: string | null;
  hasGoogleToken: boolean;
  reminders: LocalReminder[];
  calendarEvents: CalendarEventSummary[];
  gmailMessages: GmailMessageSummary[];
  isLoadingWorkspace: boolean;
  onAddGoogleAccount: (loginHint?: string) => Promise<void>;
  onSwitchAccount: (email: string) => Promise<void>;
  onSignOut: () => Promise<void>;
  onAddReminder: (title: string, dueAtIso: string, syncCalendar: boolean) => Promise<void>;
  onCompleteReminder: (id: string) => Promise<void>;
  onDeleteReminder: (id: string) => Promise<void>;
  onRefreshWorkspace: () => Promise<void>;
  onSendEmail: (to: string, subject: string, body: string) => Promise<void>;
}

export const ScheduleMailView: React.FC<ScheduleMailViewProps> = ({
  accounts,
  activeEmail,
  hasGoogleToken,
  reminders,
  calendarEvents,
  gmailMessages,
  isLoadingWorkspace,
  onAddGoogleAccount,
  onSwitchAccount,
  onSignOut,
  onAddReminder,
  onCompleteReminder,
  onDeleteReminder,
  onRefreshWorkspace,
  onSendEmail,
}) => {
  const [remTitle, setRemTitle] = useState('');
  const [remTime, setRemTime] = useState(() => {
    const d = new Date(Date.now() + 3600000);
    return d.toISOString().slice(0, 16);
  });
  const [syncToCalendar, setSyncToCalendar] = useState(true);
  const [notifStatus, setNotifStatus] = useState<string>(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [emailTo, setEmailTo] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [confirmSendOpen, setConfirmSendOpen] = useState(false);
  const [mailStatus, setMailStatus] = useState<string | null>(null);

  const requestPushPermission = async () => {
    if (typeof Notification === 'undefined') {
      setNotifStatus('unsupported');
      return;
    }
    const res = await Notification.requestPermission();
    setNotifStatus(res);
    if (res === 'granted') {
      new Notification('ZAPIA Notificações Push Ativas', {
        body: 'Você receberá alertas de compromissos e sincronização em tempo real.',
        icon: '/pwa-192x192.png',
      });
    }
  };

  const handleReminderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!remTitle.trim()) return;
    await onAddReminder(remTitle.trim(), new Date(remTime).toISOString(), syncToCalendar && hasGoogleToken);
    setRemTitle('');
  };

  const handleConfirmEmailSend = async () => {
    setConfirmSendOpen(false);
    await onSendEmail(emailTo.trim(), emailSubject.trim(), emailBody.trim());
    setEmailTo('');
    setEmailSubject('');
    setEmailBody('');
    setMailStatus('E-mail enviado com segurança pelo Gmail.');
  };

  return (
    <div className="space-y-6">
      {/* Multi-Account Gmail & Google Workspace Card */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
              Contas Gmail & Google Workspace
            </h2>
            <p className="text-xs text-[var(--zapia-muted)]">
              Alterne entre múltiplas contas Google para ler e-mails, sincronizar agenda e salvar backups no Drive
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!hasGoogleToken ? (
              <button
                type="button"
                onClick={() => onAddGoogleAccount()}
                className="inline-flex items-center gap-3 px-4 py-2 rounded-lg bg-white text-slate-900 border border-slate-300 text-xs font-semibold shadow-sm hover:bg-slate-50 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>Entrar com Google</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => onAddGoogleAccount()}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>Adicionar outra conta Gmail</span>
                </button>
                <button
                  type="button"
                  onClick={onRefreshWorkspace}
                  disabled={isLoadingWorkspace}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  <RefreshCw className={`w-4 h-4 ${isLoadingWorkspace ? 'animate-spin' : ''}`} />
                  <span>Sincronizar</span>
                </button>
                <button
                  type="button"
                  onClick={onSignOut}
                  className="px-3.5 py-2 rounded-xl border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-muted)] hover:text-rose-500"
                >
                  Sair
                </button>
              </>
            )}
          </div>
        </div>

        {accounts.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--zapia-border)]">
            {accounts.map((acc) => {
              const isActive = acc.email === activeEmail;
              return (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => onSwitchAccount(acc.email)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-colors ${
                    isActive
                      ? 'border-[var(--zapia-accent)] bg-[var(--zapia-accent-soft)] text-[var(--zapia-text)] font-semibold'
                      : 'border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]'
                  }`}
                >
                  <span>{acc.displayName}</span>
                  <span aria-hidden="true">·</span>
                  <span>{acc.email}</span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reminders & Google Calendar */}
        <section className="lg:col-span-6 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--zapia-accent)]" />
              <h3 className="text-base font-semibold text-[var(--zapia-text)]">
                Agenda & Notificações Push
              </h3>
            </div>
            <button
              type="button"
              onClick={requestPushPermission}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)]"
            >
              <Bell className="w-3.5 h-3.5 text-[var(--zapia-accent)]" />
              <span>{notifStatus === 'granted' ? 'Push Ativo' : 'Ativar Alertas Push'}</span>
            </button>
          </div>

          <form onSubmit={handleReminderSubmit} className="space-y-3">
            <input
              type="text"
              value={remTitle}
              onChange={(e) => setRemTitle(e.target.value)}
              placeholder="Novo compromisso ou lembrete..."
              aria-label="Título do compromisso"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
            />
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="datetime-local"
                value={remTime}
                onChange={(e) => setRemTime(e.target.value)}
                aria-label="Data e hora do compromisso"
                className="px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)] font-mono-tabular"
              />
              {hasGoogleToken && (
                <label className="inline-flex items-center gap-2 text-xs text-[var(--zapia-muted)] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={syncToCalendar}
                    onChange={(e) => setSyncToCalendar(e.target.checked)}
                    className="accent-[var(--zapia-accent)]"
                  />
                  <span>Sincronizar Google Agenda</span>
                </label>
              )}
              <button
                type="submit"
                disabled={!remTitle.trim()}
                className="ml-auto inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Agendar</span>
              </button>
            </div>
          </form>

          <div className="divide-y divide-[var(--zapia-border)] max-h-72 overflow-y-auto">
            {reminders.map((rem) => {
              const done = rem.status === 'concluido';
              return (
                <div key={rem.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className={`text-sm font-medium truncate ${done ? 'line-through text-[var(--zapia-muted)]' : 'text-[var(--zapia-text)]'}`}>
                      {rem.title}
                    </div>
                    <div className="text-xs text-[var(--zapia-muted)] font-mono-tabular">
                      {new Date(rem.dueAtIso).toLocaleString('pt-BR')} · {done ? 'Concluído' : 'Pendente'}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {!done && (
                      <button
                        type="button"
                        aria-label={`Concluir ${rem.title}`}
                        onClick={() => onCompleteReminder(rem.id)}
                        className="p-2 rounded-lg text-emerald-500 hover:bg-[var(--zapia-surface-alt)]"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      type="button"
                      aria-label={`Excluir ${rem.title}`}
                      onClick={() => onDeleteReminder(rem.id)}
                      className="p-2 rounded-lg text-[var(--zapia-muted)] hover:text-rose-500 hover:bg-[var(--zapia-surface-alt)]"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {calendarEvents.length > 0 && (
            <div className="pt-3 border-t border-[var(--zapia-border)] space-y-2">
              <div className="text-xs font-semibold text-[var(--zapia-muted)]">
                Próximos Eventos no Google Agenda
              </div>
              <ul className="space-y-1.5">
                {calendarEvents.slice(0, 5).map((ev) => (
                  <li key={ev.id} className="text-xs flex justify-between gap-2 text-[var(--zapia-text)]">
                    <span className="truncate">{ev.summary}</span>
                    <span className="text-[var(--zapia-muted)] font-mono-tabular shrink-0">
                      {new Date(ev.startIso).toLocaleDateString('pt-BR')}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        {/* Gmail Reader & Safe Composer */}
        <section className="lg:col-span-6 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-[var(--zapia-accent)]" />
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Caixa de Entrada & Envio Gmail
            </h3>
          </div>

          {!hasGoogleToken ? (
            <p className="text-xs text-[var(--zapia-muted)]">
              Conecte uma conta Google acima para visualizar mensagens reais do Gmail e enviar e-mails com confirmação.
            </p>
          ) : (
            <>
              <div className="divide-y divide-[var(--zapia-border)] max-h-52 overflow-y-auto">
                {gmailMessages.length === 0 ? (
                  <p className="text-xs text-[var(--zapia-muted)] py-2">
                    Nenhuma mensagem recente carregada. Clique em Sincronizar acima.
                  </p>
                ) : (
                  gmailMessages.map((msg) => (
                    <div key={msg.id} className="py-2.5 space-y-1">
                      <div className="text-xs font-semibold text-[var(--zapia-text)] truncate">{msg.subject}</div>
                      <div className="text-[11px] text-[var(--zapia-muted)] truncate">{msg.from}</div>
                      <p className="text-xs text-[var(--zapia-muted)] line-clamp-2">{msg.snippet}</p>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!emailTo.trim() || !emailSubject.trim() || !emailBody.trim()) return;
                  setConfirmSendOpen(true);
                }}
                className="pt-3 border-t border-[var(--zapia-border)] space-y-2.5"
              >
                <div className="text-xs font-semibold text-[var(--zapia-text)]">Novo E-mail</div>
                <input
                  type="email"
                  required
                  value={emailTo}
                  onChange={(e) => setEmailTo(e.target.value)}
                  placeholder="Para: destinatario@gmail.com"
                  aria-label="Destinatário do e-mail"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                />
                <input
                  type="text"
                  required
                  value={emailSubject}
                  onChange={(e) => setEmailSubject(e.target.value)}
                  placeholder="Assunto"
                  aria-label="Assunto do e-mail"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                />
                <textarea
                  rows={2}
                  required
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                  placeholder="Mensagem..."
                  aria-label="Corpo do e-mail"
                  className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
                />
                <button
                  type="submit"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Revisar e Enviar</span>
                </button>
                {mailStatus && <p className="text-xs text-emerald-500">{mailStatus}</p>}
              </form>
            </>
          )}
        </section>
      </div>

      {/* Mandatory Confirmation Dialog for Sending Gmail */}
      {confirmSendOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-6 space-y-4">
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Confirmar Envio de E-mail
            </h3>
            <div className="text-xs text-[var(--zapia-muted)] space-y-1.5">
              <p><strong>Para:</strong> {emailTo}</p>
              <p><strong>Assunto:</strong> {emailSubject}</p>
              <p className="p-2.5 rounded-lg bg-[var(--zapia-bg)] border border-[var(--zapia-border)] text-[var(--zapia-text)]">
                {emailBody}
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmSendOpen(false)}
                className="px-4 py-2 rounded-lg border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmEmailSend}
                className="px-4 py-2 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold"
              >
                Confirmar Envio
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
