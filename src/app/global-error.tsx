'use client';

import { useEffect } from 'react';

/**
 * Kök (root layout) hata sınırı (Faz 7.3).
 * Kök düzeyde çökme olursa layout devre dışı kalacağından kendi <html>/<body>
 * ağacını render eder. "White Screen of Death" engellenir.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Kök hata sınırı:', error);
  }, [error]);

  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#020617',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '24px',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: '100%',
            textAlign: 'center',
            background: '#0f172a',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 16,
            padding: 32,
            color: '#e2e8f0',
          }}
        >
          <h1 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px' }}>
            Sistem geçici olarak yanıt veremedi
          </h1>
          <p style={{ fontSize: 14, color: '#94a3b8', margin: '0 0 24px' }}>
            Uygulama beklenmeyen bir durumla karşılaştı. Verileriniz yerel
            hafızada korunmaktadır. Lütfen yeniden başlatın.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: '#059669',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              padding: '10px 18px',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Yeniden Başlat
          </button>
        </div>
      </body>
    </html>
  );
}
