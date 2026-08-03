import Header from "@/components/common/Header";
import CommandHero from "@/components/common/CommandHero";
import WorkspaceTabs from "@/components/common/WorkspaceTabs";

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      <Header />

      {/* Üst başlık + özet sayılar */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto w-full max-w-[92rem] px-4 py-6 sm:px-6">
          <div className="mb-5">
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
              Sosyal Yardım Dağıtım &amp; Rota Yönetimi
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Adres yükleyin, haritalayın, rota oluşturun ve şoförle paylaşın.
            </p>
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
    </div>
  );
}
