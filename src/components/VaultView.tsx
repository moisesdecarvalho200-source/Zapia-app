import React, { useState } from 'react';
import {
  FileText,
  Upload,
  Download,
  Printer,
  Share2,
  ShieldCheck,
  ShieldAlert,
  CloudUpload,
  Trash2,
  Lock,
  Plus,
  Search,
  RefreshCw,
} from 'lucide-react';
import { LocalVaultItem } from '../utils/offlineDb';
import { decryptBytesE2EE } from '../utils/cryptoVault';
import { ContactSummary, DriveFileSummary } from '../services/firebaseService';

interface VaultViewProps {
  items: LocalVaultItem[];
  driveFiles: DriveFileSummary[];
  contacts: ContactSummary[];
  hasGoogleToken: boolean;
  isLoadingDrive: boolean;
  onCreateNoteFile: (title: string, content: string) => Promise<void>;
  onUploadLocalFiles: (files: FileList) => Promise<void>;
  onUploadToDrive: (item: LocalVaultItem) => Promise<void>;
  onRefreshDrive: () => Promise<void>;
  onShareViaGmail: (to: string, subject: string, body: string) => Promise<void>;
  onDeleteItem: (id: string) => Promise<void>;
  onRequestGoogleLogin: () => Promise<void>;
}

export const VaultView: React.FC<VaultViewProps> = ({
  items,
  driveFiles,
  contacts,
  hasGoogleToken,
  isLoadingDrive,
  onCreateNoteFile,
  onUploadLocalFiles,
  onUploadToDrive,
  onRefreshDrive,
  onShareViaGmail,
  onDeleteItem,
  onRequestGoogleLogin,
}) => {
  const [search, setSearch] = useState('');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteBody, setNoteBody] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [shareModalItem, setShareModalItem] = useState<LocalVaultItem | null>(null);
  const [shareRecipient, setShareRecipient] = useState('');
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<LocalVaultItem | null>(null);
  const [previewData, setPreviewData] = useState<{ title: string; text: string } | null>(null);

  const filtered = items.filter((item) =>
    item.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) return;
    const safeTitle = noteTitle.trim().endsWith('.txt') ? noteTitle.trim() : `${noteTitle.trim()}.txt`;
    await onCreateNoteFile(safeTitle, noteBody);
    setNoteTitle('');
    setNoteBody('');
    setStatusMessage(`Arquivo "${safeTitle}" criptografado com AES-256-GCM e salvo offline.`);
  };

  const handleDownload = async (item: LocalVaultItem) => {
    const plainBytes = await decryptBytesE2EE(item.encryptedPayload, item.iv);
    const copy = new Uint8Array(plainBytes.length);
    copy.set(plainBytes);
    const blob = new Blob([copy.buffer], { type: item.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = item.title;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setStatusMessage(`Download de "${item.title}" concluído.`);
  };

  const handlePreviewAndPrint = async (item: LocalVaultItem) => {
    const plainBytes = await decryptBytesE2EE(item.encryptedPayload, item.iv);
    const text = item.mimeType.startsWith('text/') || item.mimeType.includes('json')
      ? new TextDecoder().decode(plainBytes)
      : `Arquivo binário (${item.mimeType}) · ${item.sizeBytes} bytes · SHA-256: ${item.sha256}`;
    setPreviewData({ title: item.title, text });
  };

  const handleNativeShareOrEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shareModalItem || !shareRecipient.trim()) return;
    const plainBytes = await decryptBytesE2EE(shareModalItem.encryptedPayload, shareModalItem.iv);
    const contentPreview = shareModalItem.mimeType.startsWith('text/')
      ? new TextDecoder().decode(plainBytes).slice(0, 4000)
      : `Arquivo compartilhado: ${shareModalItem.title} (SHA-256: ${shareModalItem.sha256})`;
    await onShareViaGmail(shareRecipient.trim(), `ZAPIA Compartilhamento: ${shareModalItem.title}`, contentPreview);
    setShareModalItem(null);
    setShareRecipient('');
    setStatusMessage(`Arquivo compartilhado com ${shareRecipient}.`);
  };

  const handleSystemShare = async (item: LocalVaultItem) => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        const plainBytes = await decryptBytesE2EE(item.encryptedPayload, item.iv);
        const copy = new Uint8Array(plainBytes.length);
        copy.set(plainBytes);
        const file = new File([copy.buffer], item.title, { type: item.mimeType });
        await navigator.share({
          title: item.title,
          text: `Enviado via ZAPIA Cofre Seguro (SHA-256: ${item.sha256.slice(0, 12)})`,
          files: navigator.canShare?.({ files: [file] }) ? [file] : undefined,
        });
        return;
      } catch {
        // User cancelled or file share unsupported; fall back to contact modal
      }
    }
    setShareModalItem(item);
  };

  return (
    <div className="space-y-6">
      {/* Top Action & Creation Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleCreateSubmit}
          className="lg:col-span-7 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--zapia-text)]">
              Criar Documento Criptografado
            </h2>
            <span className="inline-flex items-center gap-1.5 text-xs text-[var(--zapia-muted)]">
              <Lock className="w-3.5 h-3.5 text-emerald-500" />
              AES-256-GCM Local
            </span>
          </div>
          <div className="space-y-3">
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Nome do arquivo (ex: Contrato_Projeto.txt)"
              aria-label="Nome do arquivo"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
            />
            <textarea
              rows={3}
              value={noteBody}
              onChange={(e) => setNoteBody(e.target.value)}
              placeholder="Conteúdo real do documento para criptografar, baixar, imprimir ou enviar ao Drive..."
              aria-label="Conteúdo do documento"
              className="w-full px-3.5 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={!noteTitle.trim() || !noteBody.trim()}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Criptografar e Salvar</span>
              </button>

              <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] cursor-pointer hover:border-[var(--zapia-accent)]">
                <Upload className="w-4 h-4" />
                <span>Importar do Android / PC</span>
                <input
                  type="file"
                  multiple
                  className="sr-only"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      onUploadLocalFiles(e.target.files);
                      e.target.value = '';
                    }
                  }}
                />
              </label>
            </div>
          </div>
        </form>

        {/* Google Drive Live Sync Card */}
        <section className="lg:col-span-5 rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Sincronização Google Drive
            </h3>
            {hasGoogleToken && (
              <button
                type="button"
                onClick={onRefreshDrive}
                disabled={isLoadingDrive}
                aria-label="Atualizar arquivos do Google Drive"
                className="p-2 rounded-lg border border-[var(--zapia-border)] hover:border-[var(--zapia-accent)] text-[var(--zapia-muted)] hover:text-[var(--zapia-text)]"
              >
                <RefreshCw className={`w-4 h-4 ${isLoadingDrive ? 'animate-spin' : ''}`} />
              </button>
            )}
          </div>

          {!hasGoogleToken ? (
            <div className="space-y-3 py-2">
              <p className="text-xs text-[var(--zapia-muted)] leading-relaxed">
                Conecte sua conta Google/Gmail para sincronizar automaticamente documentos e backups criptografados com o Google Drive.
              </p>
              <button
                type="button"
                onClick={onRequestGoogleLogin}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] text-xs font-semibold text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
              >
                <CloudUpload className="w-4 h-4 text-[var(--zapia-accent)]" />
                <span>Conectar Google Drive</span>
              </button>
            </div>
          ) : (
            <ul className="space-y-2 max-h-44 overflow-y-auto">
              {driveFiles.length === 0 ? (
                <li className="text-xs text-[var(--zapia-muted)]">
                  Nenhum arquivo listado ainda. Clique em atualizar ou envie um arquivo do cofre.
                </li>
              ) : (
                driveFiles.slice(0, 8).map((df) => (
                  <li key={df.id} className="flex items-center justify-between gap-2 text-xs py-1.5 border-b border-[var(--zapia-border)] last:border-b-0">
                    <span className="truncate text-[var(--zapia-text)]">{df.name}</span>
                    {df.webViewLink && (
                      <a
                        href={df.webViewLink}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[var(--zapia-accent)] hover:underline shrink-0"
                      >
                        Abrir
                      </a>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}
        </section>
      </div>

      {statusMessage && (
        <div className="rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] px-4 py-2.5 text-xs text-[var(--zapia-text)]" role="status">
          {statusMessage}
        </div>
      )}

      {/* Encrypted Vault List */}
      <section className="rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-[var(--zapia-text)]">
            Cofre Offline & Documentos Reais ({filtered.length})
          </h3>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-[var(--zapia-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar no cofre..."
              aria-label="Buscar arquivos no cofre"
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-xs text-[var(--zapia-text)]"
            />
          </div>
        </div>

        <div className="divide-y divide-[var(--zapia-border)]" data-testid="vault-list">
          {filtered.map((item) => (
            <div key={item.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5 text-[var(--zapia-accent)]" />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-semibold text-[var(--zapia-text)] truncate">
                    {item.title}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--zapia-muted)] font-mono-tabular">
                    <span>{(item.sizeBytes / 1024).toFixed(1)} KB</span>
                    <span aria-hidden="true">·</span>
                    <span>SHA-256: {item.sha256.slice(0, 12)}</span>
                    <span aria-hidden="true">·</span>
                    <span className={`inline-flex items-center gap-1 ${item.scanStatus === 'limpo' ? 'text-emerald-500' : 'text-amber-500'}`}>
                      {item.scanStatus === 'limpo' ? <ShieldCheck className="w-3.5 h-3.5" /> : <ShieldAlert className="w-3.5 h-3.5" />}
                      {item.scanStatus === 'limpo' ? 'Verificado' : item.scanStatus === 'quarentena' ? 'Quarentena' : 'Alerta'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleDownload(item)}
                  aria-label={`Baixar ${item.title}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar</span>
                </button>
                <button
                  type="button"
                  onClick={() => handlePreviewAndPrint(item)}
                  aria-label={`Visualizar e imprimir ${item.title}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Imprimir</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSystemShare(item)}
                  aria-label={`Compartilhar ${item.title}`}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar</span>
                </button>
                {hasGoogleToken && (
                  <button
                    type="button"
                    onClick={() => onUploadToDrive(item)}
                    aria-label={`Salvar ${item.title} no Google Drive`}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-xs font-medium text-[var(--zapia-text)] hover:border-[var(--zapia-accent)]"
                  >
                    <CloudUpload className="w-3.5 h-3.5" />
                    <span>Drive</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDeleteConfirmItem(item)}
                  aria-label={`Excluir ${item.title}`}
                  className="p-2 rounded-lg border border-[var(--zapia-border)] text-[var(--zapia-muted)] hover:text-rose-500 hover:border-rose-500/40"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Print Preview Modal */}
      {previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-2xl rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-6 space-y-4">
            <h3 className="text-lg font-semibold text-[var(--zapia-text)]">{previewData.title}</h3>
            <pre className="p-4 rounded-xl bg-[var(--zapia-bg)] border border-[var(--zapia-border)] text-xs text-[var(--zapia-text)] max-h-80 overflow-auto whitespace-pre-wrap font-mono-tabular">
              {previewData.text}
            </pre>
            <div className="flex justify-end gap-3 no-print">
              <button
                type="button"
                onClick={() => setPreviewData(null)}
                className="px-4 py-2 rounded-lg border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                Fechar
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold"
              >
                <Printer className="w-4 h-4" />
                <span>Imprimir Agora</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Share via Contact / Gmail Confirmation Modal */}
      {shareModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <form onSubmit={handleNativeShareOrEmail} className="w-full max-w-md rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-6 space-y-4">
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Confirmar Compartilhamento Seguro
            </h3>
            <p className="text-xs text-[var(--zapia-muted)]">
              Você está prestes a enviar o conteúdo descriptografado de <strong>{shareModalItem.title}</strong> pelo seu Gmail conectado.
            </p>
            <div>
              <label htmlFor="share-recipient-input" className="block text-xs text-[var(--zapia-muted)] mb-1">
                Destinatário (e-mail ou contato)
              </label>
              <input
                id="share-recipient-input"
                type="email"
                required
                value={shareRecipient}
                onChange={(e) => setShareRecipient(e.target.value)}
                placeholder="contato@gmail.com"
                className="w-full px-3 py-2 rounded-xl border border-[var(--zapia-border)] bg-[var(--zapia-bg)] text-sm text-[var(--zapia-text)]"
              />
            </div>
            {contacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {contacts.slice(0, 5).map((c) => (
                  <button
                    key={c.email}
                    type="button"
                    onClick={() => setShareRecipient(c.email)}
                    className="text-xs px-2.5 py-1 rounded-lg bg-[var(--zapia-surface-alt)] border border-[var(--zapia-border)] text-[var(--zapia-text)]"
                  >
                    {c.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShareModalItem(null)}
                className="px-4 py-2 rounded-lg border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={!hasGoogleToken}
                className="px-4 py-2 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold disabled:opacity-50"
              >
                Confirmar Envio
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-6 space-y-4">
            <h3 className="text-base font-semibold text-[var(--zapia-text)]">
              Excluir arquivo do cofre?
            </h3>
            <p className="text-xs text-[var(--zapia-muted)]">
              Tem certeza que deseja remover permanentemente <strong>{deleteConfirmItem.title}</strong> do cofre local e da sincronização?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmItem(null)}
                className="px-4 py-2 rounded-lg border border-[var(--zapia-border)] text-xs font-medium text-[var(--zapia-text)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  const id = deleteConfirmItem.id;
                  setDeleteConfirmItem(null);
                  await onDeleteItem(id);
                }}
                className="px-4 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold"
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
