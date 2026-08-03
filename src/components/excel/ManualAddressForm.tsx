'use client';

import { useState } from 'react';
import { Plus, X, UserPlus, Check } from 'lucide-react';

import { useDeliveryStore } from '@/store/useDeliveryStore';
import { rawRowToSanitized } from '@/lib/sanitizeAddress';
import type { RawExcelRow } from '@/types/address';

const EMPTY = {
  adSoyad: '',
  mahalle: '',
  caddeSokak: '',
  binaNo: '',
  daireNo: '',
  telefon: '',
  koliSayisi: '1',
};

/**
 * Elle tek adres ekleme formu (telefonla gelen tek başvuru vb.).
 * Girdiler mevcut adres-temizleme hattından geçirilip listeye eklenir;
 * konumlandırma Adım 2'de Google ile yapılır.
 */
export default function ManualAddressForm() {
  const addSanitizedAddress = useDeliveryStore((s) => s.addSanitizedAddress);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ ...EMPTY });
  const [error, setError] = useState<string | null>(null);
  const [justAdded, setJustAdded] = useState<string | null>(null);

  const set = (key: keyof typeof EMPTY, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const submit = () => {
    setError(null);
    const adSoyad = form.adSoyad.trim();
    const mahalle = form.mahalle.trim();
    const caddeSokak = form.caddeSokak.trim();

    if (!adSoyad) {
      setError('Alıcı adı gerekli.');
      return;
    }
    if (!mahalle && !caddeSokak) {
      setError('En az mahalle veya cadde/sokak girin.');
      return;
    }

    // Açık adresi parçalardan kur (geocoding için tam metin).
    const parts: string[] = [];
    if (mahalle) parts.push(`${mahalle} Mah.`);
    if (caddeSokak) parts.push(caddeSokak);
    if (form.binaNo.trim()) parts.push(`No:${form.binaNo.trim()}`);
    if (form.daireNo.trim()) parts.push(`Daire ${form.daireNo.trim()}`);

    const koli = parseInt(form.koliSayisi, 10);
    const raw: RawExcelRow = {
      adSoyad,
      telefon: form.telefon.trim(),
      mahalle,
      caddeSokak,
      binaNo: form.binaNo.trim(),
      daireNo: form.daireNo.trim(),
      acikAdres: parts.join(' '),
      koliSayisi: Number.isFinite(koli) && koli > 0 ? koli : 1,
    };

    addSanitizedAddress(rawRowToSanitized(raw));
    setForm({ ...EMPTY });
    setJustAdded(adSoyad);
    window.setTimeout(() => setJustAdded(null), 2500);
  };

  if (!open) {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700"
        >
          <UserPlus className="h-4 w-4" />
          Elle Adres Ekle
        </button>
        {justAdded && (
          <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600">
            <Check className="h-3.5 w-3.5" />
            {justAdded} eklendi
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-slate-800">
          <UserPlus className="h-4 w-4 text-emerald-600" />
          Elle Adres Ekle
        </h4>
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
          }}
          className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-200"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field label="Alıcı Adı *">
          <input
            value={form.adSoyad}
            onChange={(e) => set('adSoyad', e.target.value)}
            placeholder="Ör. Ayşe Yılmaz"
            className={inputCls}
          />
        </Field>
        <Field label="Telefon">
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.telefon}
            onChange={(e) => set('telefon', e.target.value)}
            placeholder="05xx xxx xx xx"
            className={inputCls}
          />
        </Field>
        <Field label="Mahalle">
          <input
            value={form.mahalle}
            onChange={(e) => set('mahalle', e.target.value)}
            placeholder="Ör. Fevzi Çakmak"
            className={inputCls}
          />
        </Field>
        <Field label="Cadde / Sokak">
          <input
            value={form.caddeSokak}
            onChange={(e) => set('caddeSokak', e.target.value)}
            placeholder="Ör. Selanik Sokak"
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-3 gap-2">
          <Field label="Bina No">
            <input
              inputMode="numeric"
              value={form.binaNo}
              onChange={(e) => set('binaNo', e.target.value)}
              placeholder="5"
              className={inputCls}
            />
          </Field>
          <Field label="Daire">
            <input
              inputMode="numeric"
              value={form.daireNo}
              onChange={(e) => set('daireNo', e.target.value)}
              placeholder="3"
              className={inputCls}
            />
          </Field>
          <Field label="Koli">
            <input
              type="number"
              min={1}
              value={form.koliSayisi}
              onChange={(e) => set('koliSayisi', e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>
      </div>

      {error && (
        <p role="alert" className="mt-2 text-xs font-medium text-red-600">
          {error}
        </p>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={submit}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 active:scale-95"
        >
          <Plus className="h-4 w-4" />
          Listeye Ekle
        </button>
        {justAdded && (
          <span
            aria-live="polite"
            className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600"
          >
            <Check className="h-3.5 w-3.5" />
            {justAdded} eklendi — bir tane daha girebilirsiniz
          </span>
        )}
      </div>
    </div>
  );
}

const inputCls =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-emerald-500 focus:outline-none';

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
