import { Activity, Sparkles } from "lucide-react";

import Header from "@/components/common/Header";
import CommandHero from "@/components/common/CommandHero";
import WorkspaceTabs from "@/components/common/WorkspaceTabs";
import LiveNotificationPanel from "@/components/common/LiveNotificationPanel";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/* Komuta merkezi hero — koyu zemin, KPI şeridi */}
      <section className="command-bg border-b border-white/10">
        <div className="mx-auto w-full max-w-[92rem] px-4 py-7 sm:px-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/25 bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                <Activity className="h-3.5 w-3.5" />
                Canlı Komuta Merkezi
              </span>
              <h2 className="mt-3 text-2xl font-bold tracking-tight text-white sm:text-3xl">
                Sosyal Yardım Dağıtım &amp; Rota Kontrol Merkezi
              </h2>
              <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-300">
                Adres doğrulama, kapasiteye göre coğrafi kümeleme, OSRM rota
                optimizasyonu ve saha takibini tek panelden yönetin.
              </p>
            </div>
            <span className="hidden items-center gap-1.5 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-medium text-slate-300 lg:inline-flex">
              <Sparkles className="h-4 w-4 text-emerald-300" />
              Yeşil Belediye · Akıllı Rota
            </span>
          </div>

          <CommandHero />
        </div>
      </section>

      {/* Kontrol konsolu (sekmeli iş akışı) */}
      <main className="mx-auto w-full max-w-[92rem] flex-1 px-4 py-6 sm:px-6">
        <WorkspaceTabs />
      </main>

      <footer className="border-t border-slate-200 bg-white/60 py-4">
        <div className="mx-auto max-w-[92rem] px-4 text-center text-xs text-slate-500 sm:px-6">
          Pendik Belediyesi Sosyal Yardım Hizmetleri Müdürlüğü · Akıllı Lojistik
          &amp; Rota Optimizasyon Sistemi
        </div>
      </footer>

      {/* Canlı bildirim akışı (sağ alt) */}
      <LiveNotificationPanel />
    </div>
  );
}
