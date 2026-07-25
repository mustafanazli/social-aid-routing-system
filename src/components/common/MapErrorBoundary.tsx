'use client';

import { Component, type ReactNode } from 'react';
import { MapPinOff, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Otomatik yeniden deneme gecikmesi (ms). */
  retryMs?: number;
}

interface State {
  hasError: boolean;
  countdown: number;
}

/**
 * Harita hata sınırı (Faz 7.3).
 * Leaflet / OSM / react-leaflet render sırasında hata fırlatırsa tüm sayfa
 * beyaz ekrana düşmez; şık kurumsal bir mesaj gösterilir ve otomatik yeniden
 * deneme (retry) yapılır.
 */
export default class MapErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, countdown: 0 };
  private timer: number | null = null;

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch() {
    const total = Math.round((this.props.retryMs ?? 5000) / 1000);
    this.setState({ countdown: total });
    // Geri sayım + otomatik yeniden deneme.
    this.timer = window.setInterval(() => {
      this.setState((s) => {
        if (s.countdown <= 1) {
          this.clearTimer();
          return { hasError: false, countdown: 0 };
        }
        return { hasError: true, countdown: s.countdown - 1 };
      });
    }, 1000);
  }

  componentWillUnmount() {
    this.clearTimer();
  }

  private clearTimer() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
  }

  private handleRetry = () => {
    this.clearTimer();
    this.setState({ hasError: false, countdown: 0 });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex h-full min-h-[16rem] flex-col items-center justify-center gap-3 bg-slate-50 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-600">
          <MapPinOff className="h-7 w-7" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            Harita servisine anlık ulaşılamıyor
          </p>
          <p className="mt-1 max-w-xs text-xs text-slate-500">
            Harita/rota servisi geçici olarak yanıt vermiyor. Lütfen birkaç
            saniye sonra tekrar deneyin veya alternatif rota bilgisini listeden
            takip edin.
          </p>
        </div>
        <button
          type="button"
          onClick={this.handleRetry}
          className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-900 active:scale-95"
        >
          <RefreshCw className="h-4 w-4" />
          {this.state.countdown > 0
            ? `Yeniden deneniyor (${this.state.countdown})`
            : 'Tekrar Dene'}
        </button>
      </div>
    );
  }
}
