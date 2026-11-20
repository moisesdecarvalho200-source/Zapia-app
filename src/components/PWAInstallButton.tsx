import React, { useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC = () => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-xs font-semibold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Download className="w-4 h-4" />
        <span>Instalar App</span>
      </button>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setShowGuide(true)}
        aria-label={isIOS ? 'Instalar no iOS' : 'Instalar App Android ou PC'}
        className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-lg border border-[var(--zapia-border)] bg-[var(--zapia-surface-alt)] text-[var(--zapia-text)] text-xs font-medium hover:border-[var(--zapia-accent)] transition-colors whitespace-nowrap shrink-0 min-h-[40px]"
      >
        <Smartphone className="w-4 h-4 shrink-0" />
        <span className="hidden sm:inline">{isIOS ? 'Instalar no iOS' : 'App Android / PC'}</span>
        <span className="sm:hidden">App</span>
      </button>

      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" role="dialog" aria-modal="true" aria-labelledby="pwa-guide-title">
          <div className="w-full max-w-md rounded-2xl border border-[var(--zapia-border)] bg-[var(--zapia-surface)] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between gap-4">
              <h3 id="pwa-guide-title" className="text-lg font-semibold text-[var(--zapia-text)]">
                Instalar ZAPIA em qualquer dispositivo
              </h3>
              <button
                type="button"
                aria-label="Fechar guia de instalação"
                onClick={() => setShowGuide(false)}
                className="p-2 rounded-lg hover:bg-[var(--zapia-surface-alt)] text-[var(--zapia-muted)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-[var(--zapia-muted)]">
              <p>
                <strong className="text-[var(--zapia-text)]">Android (Chrome / Edge):</strong> Toque no menu do navegador (⋮) e selecione <strong>Instalar aplicativo</strong> ou <strong>Adicionar à tela inicial</strong>.
              </p>
              <p>
                <strong className="text-[var(--zapia-text)]">iPhone / iPad (Safari):</strong> Toque em <strong>Compartilhar</strong> na barra inferior e escolha <strong>Adicionar à Tela de Início</strong>.
              </p>
              <p>
                <strong className="text-[var(--zapia-text)]">PC (Windows / macOS / Linux):</strong> Clique no ícone de instalação na barra de endereço do Chrome ou Edge para abrir o ZAPIA como app nativo offline.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowGuide(false)}
              className="w-full py-2.5 rounded-lg bg-[var(--zapia-accent)] text-[var(--zapia-accent-fg)] text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </>
  );
};
