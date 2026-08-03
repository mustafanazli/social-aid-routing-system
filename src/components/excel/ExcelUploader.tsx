'use client';

import { useCallback, useRef, useState } from 'react';
import {
  UploadCloud,
  FileSpreadsheet,
  Loader2,
  AlertCircle,
  Download,
} from 'lucide-react';

import { parseExcelFile, downloadSampleTemplate } from '@/lib/excelUtils';
import { parsePdfFile } from '@/lib/pdfImport';
import { useDeliveryStore } from '@/store/useDeliveryStore';
import type { RawExcelRow } from '@/types/address';
import { cn } from '@/lib/utils';
import {
  validateExcelFile,
  ACCEPTED_EXCEL_EXTENSIONS,
} from '@/lib/security';

const MAX_PDF_SIZE = 8 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [...ACCEPTED_EXCEL_EXTENSIONS, '.pdf'];

interface ExcelUploaderProps {
  /** Satırlar başarıyla okunduğunda tetiklenir (store'a rawAddresses yazıldıktan sonra). */
  onParsed?: (rows: RawExcelRow[]) => void;
  /** Kompakt görünüm (yeniden yükleme çubuğu için). */
  compact?: boolean;
}

/**
 * Sürükle-bırak destekli Excel/CSV yükleme alanı.
 * SheetJS ile satırları okur ve store'daki setRawAddresses'e aktarır.
 */
export default function ExcelUploader({
  onParsed,
  compact = false,
}: ExcelUploaderProps) {
  const setRawAddresses = useDeliveryStore((s) => s.setRawAddresses);
  const setExcelRows = useDeliveryStore((s) => s.setExcelRows);

  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      const isPdf = file.name.toLowerCase().endsWith('.pdf');

      if (isPdf) {
        // PDF: hafif doğrulama (boyut/boş); metin çıkarımı sunucuda yapılır.
        if (file.size === 0) {
          setError('Dosya boş görünüyor.');
          return;
        }
        if (file.size > MAX_PDF_SIZE) {
          setError('PDF çok büyük (maks. 8 MB).');
          return;
        }
      } else {
        // Excel/CSV: uzantı + MIME + boyut (maks. 5 MB) denetimi (Faz 7.1).
        const validation = validateExcelFile(file);
        if (!validation.ok) {
          setError(validation.error ?? 'Dosya reddedildi.');
          return;
        }
      }

      setIsParsing(true);
      try {
        const rows = isPdf
          ? await parsePdfFile(file)
          : await parseExcelFile(file);
        setExcelRows(rows);
        setRawAddresses(rows);
        onParsed?.(rows);
      } catch (err) {
        const message =
          err instanceof Error
            ? err.message
            : 'Dosya okunurken beklenmeyen bir hata oluştu.';
        setError(message);
      } finally {
        setIsParsing(false);
      }
    },
    [onParsed, setExcelRows, setRawAddresses],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = ''; // aynı dosyanın tekrar seçilebilmesi için sıfırla
    },
    [handleFile],
  );

  const openPicker = () => inputRef.current?.click();

  if (compact) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={openPicker}
          disabled={isParsing}
          className="inline-flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
        >
          {isParsing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <UploadCloud className="h-4 w-4" />
          )}
          Yeni dosya yükle
        </button>
        {error && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
            <AlertCircle className="h-3.5 w-3.5" />
            {error}
          </span>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(',')}
          className="hidden"
          onChange={onInputChange}
        />
      </div>
    );
  }

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') openPicker();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={onDrop}
        className={cn(
          'flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition',
          isDragging
            ? 'border-emerald-500 bg-emerald-50'
            : 'border-slate-300 bg-slate-50 hover:border-emerald-400 hover:bg-emerald-50/50',
          isParsing && 'pointer-events-none opacity-70',
        )}
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          {isParsing ? (
            <Loader2 className="h-7 w-7 animate-spin" />
          ) : (
            <UploadCloud className="h-7 w-7" />
          )}
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800">
            {isParsing
              ? 'Dosya okunuyor…'
              : 'Excel veya PDF dosyasını buraya sürükleyin veya seçin'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Desteklenen biçimler: .xlsx, .xls · .pdf (metin tabanlı) · Maks. 5–8 MB
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white">
          <FileSpreadsheet className="h-4 w-4" />
          Dosya Seç
        </span>
      </div>

      {error && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      <div className="mt-3 flex items-center justify-center">
        <button
          type="button"
          onClick={downloadSampleTemplate}
          className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50"
        >
          <Download className="h-3.5 w-3.5" />
          Nasıl görünmeli? Örnek Excel&apos;i indirin
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_EXTENSIONS.join(',')}
        className="hidden"
        onChange={onInputChange}
      />
    </div>
  );
}
