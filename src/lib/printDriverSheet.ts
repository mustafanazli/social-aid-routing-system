// Yazdırılabilir şoför föyü (Özellik 9).
//
// Her araç için sade, siyah-beyaz bir A4 çıktı üretir: durak sırası, alıcı,
// adres, telefon, koli, ziyaret saati ve imza/onay kutusu. Yeni bir pencerede
// açılıp otomatik yazdırma diyaloğu tetiklenir (harici bağımlılık yok).

import type { VehicleRoute, StopStatus } from '@/types/fleet';
import { stopStatusToTr } from '@/lib/excelUtils';

/** HTML enjeksiyonuna karşı metin kaçışı. */
function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function statusCell(status: StopStatus): string {
  if (status === 'DELIVERED') return '☑ ' + esc(stopStatusToTr(status));
  if (status === 'NOT_HOME') return '☒ ' + esc(stopStatusToTr(status));
  return '☐';
}

function routeSheetHtml(route: VehicleRoute): string {
  const today = new Date().toLocaleDateString('tr-TR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    weekday: 'long',
  });
  const totalBoxes = route.totalBoxesAssigned;
  const km =
    route.totalDistanceKm >= 10
      ? route.totalDistanceKm.toFixed(0)
      : route.totalDistanceKm.toFixed(1);

  const rows = [...route.stops]
    .sort((a, b) => a.stopOrder - b.stopOrder)
    .map((s) => {
      const l = s.location;
      return `<tr>
        <td class="num">${s.stopOrder}</td>
        <td>${esc(l.recipientName || '—')}</td>
        <td>${esc(l.cleanAddress)}</td>
        <td>${esc(l.phone || '—')}</td>
        <td class="num">${esc(l.boxCount)}</td>
        <td>${esc(l.timeWindow || '—')}</td>
        <td class="status">${statusCell(s.status)}</td>
        <td class="sign"></td>
      </tr>`;
    })
    .join('');

  return `<section class="sheet">
    <header>
      <div>
        <h1>Pendik Belediyesi — Sosyal Yardım Dağıtım Föyü</h1>
        <p class="muted">${esc(route.vehicleName)} · ${today}</p>
      </div>
      <div class="summary">
        <span>${route.stops.length} durak</span>
        <span>${totalBoxes} koli</span>
        <span>${km} km</span>
      </div>
    </header>
    <table>
      <thead>
        <tr>
          <th class="num">#</th><th>Alıcı</th><th>Adres</th><th>Telefon</th>
          <th class="num">Koli</th><th>Ziyaret Saati</th><th>Durum</th><th>İmza</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <footer class="muted">
      Şoför: ______________________  İmza: ______________________  Tarih: ____ / ____ / ______
    </footer>
  </section>`;
}

const PRINT_CSS = `
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; color: #111; margin: 0; padding: 16px; }
  .sheet { page-break-after: always; }
  .sheet:last-child { page-break-after: auto; }
  header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #111; padding-bottom: 8px; margin-bottom: 12px; gap: 12px; }
  h1 { font-size: 15px; margin: 0 0 2px; }
  .muted { color: #555; font-size: 11px; }
  .summary { display: flex; gap: 8px; }
  .summary span { border: 1px solid #999; border-radius: 6px; padding: 3px 8px; font-size: 11px; font-weight: 700; white-space: nowrap; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; }
  th, td { border: 1px solid #bbb; padding: 5px 6px; text-align: left; vertical-align: top; }
  th { background: #f0f0f0; font-size: 10px; text-transform: uppercase; letter-spacing: .3px; }
  td.num, th.num { text-align: center; width: 34px; }
  td.status { width: 90px; }
  td.sign { width: 90px; }
  footer { margin-top: 16px; font-size: 11px; }
  @media print { body { padding: 0; } @page { margin: 12mm; } }
`;

/** Verilen rotalar için yazdırma penceresi açar. */
export function printDriverSheets(routes: VehicleRoute[]): void {
  if (routes.length === 0) return;
  const body = routes.map(routeSheetHtml).join('');
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8">
    <title>Dağıtım Föyü</title><style>${PRINT_CSS}</style></head>
    <body>${body}<script>window.onload=function(){setTimeout(function(){window.print();},250);};<\/script></body></html>`;

  const win = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!win) return; // Açılır pencere engellendi — sessiz geç.
  win.document.open();
  win.document.write(html);
  win.document.close();
}
