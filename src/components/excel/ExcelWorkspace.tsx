'use client';

import { useCallback } from 'react';
import { FileSpreadsheet, ClipboardList, Trash2, Package } from 'lucide-react';

import ExcelUploader from '@/components/excel/ExcelUploader';
import AddressPreviewTable from '@/components/excel/AddressPreviewTable';
import ManualAddressForm from '@/components/excel/ManualAddressForm';
import { rawRowToSanitized } from '@/lib/sanitizeAddress';
import { useDeliveryStore } from '@/store/useDeliveryStore';
import { useHasHydrated } from '@/hooks/useHasHydrated';
import type { RawExcelRow } from '@/types/address';

/**
 * Faz 2 çalışma alanı: Excel yükleme → adres sanitize → önizleme tablosu.
 * Ham satırlar okunduğunda sanitizeAddress ile temizlenip store'a yazılır.
 */
export default function ExcelWorkspace() {
  const hydrated = useHasHydrated();

  const sanitizedAddresses = useDeliveryStore((s) => s.sanitizedAddresses);
  const setSanitizedAddresses = useDeliveryStore(
    (s) => s.setSanitizedAddresses,
  );
  const setExcelRows = useDeliveryStore((s) => s.setExcelRows);
  const setRawAddresses = useDeliveryStore((s) => s.setRawAddresses);

  const handleParsed = useCallback(
    (rows: RawExcelRow[]) => {
      const sanitized = rows.map(rawRowToSanitized);
      setSanitizedAddresses(sanitized);
    },
    [setSanitizedAddresses],
  );

  const handleClear = useCallback(() => {
    setSanitizedAddresses([]);
    setExcelRows([]);
    setRawAddresses([]);
  }, [setSanitizedAddresses, setExcelRows, setRawAddresses]);

  const hasData = hydrated && sanitizedAddresses.length > 0;
  const totalBoxes = sanitizedAddresses.reduce((sum, a) => sum + a.boxCount, 0);
  const withoutNeighborhood = sanitizedAddresses.filter(
    (a) => !a.neighborhood,
  ).length;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-sm font-bold text-white">
            1
          </span>
          <div>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
              <ClipboardList className="h-4 w-4 text-emerald-600" />
              Excel &amp; Adres Temizleme
            </h3>
            <p className="text-xs text-slate-500">
              Dağıtım listesini yükleyin; adresler otomatik temizlenip Pendik
              mahalleleriyle eşleştirilir.
            </p>
          </div>
        </div>

        {hasData && (
          <button
            type="button"
            onClick={handleClear}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Listeyi Temizle
          </button>
        )}
      </div>

      <div className="p-5">
        {!hasData ? (
          <div className="space-y-4">
            <ExcelUploader onParsed={handleParsed} />
            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-slate-100" />
              <span className="text-xs font-medium text-slate-400">veya</span>
              <span className="h-px flex-1 bg-slate-100" />
            </div>
            <ManualAddressForm />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Özet çubuğu */}
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700">
                <FileSpreadsheet className="h-4 w-4" />
                {sanitizedAddresses.length} adres
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-700">
                <Package className="h-4 w-4" />
                {totalBoxes} koli
              </span>
              {withoutNeighborhood > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600">
                  {withoutNeighborhood} adreste mahalle belirsiz
                </span>
              )}
              <div className="ml-auto">
                <ExcelUploader onParsed={handleParsed} compact />
              </div>
            </div>

            <ManualAddressForm />

            <AddressPreviewTable />
          </div>
        )}
      </div>
    </section>
  );
}
