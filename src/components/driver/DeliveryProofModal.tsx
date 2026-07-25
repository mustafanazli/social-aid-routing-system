'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  X,
  PenLine,
  Camera,
  Eraser,
  Check,
  RefreshCw,
} from 'lucide-react';

import type { DeliveryProof } from '@/types/fleet';

interface DeliveryProofModalProps {
  recipientName: string;
  onConfirm: (proof: DeliveryProof) => void;
  onCancel: () => void;
}

type ProofTab = 'SIGNATURE' | 'PHOTO';

/** Fotoğrafı küçültüp base64 JPEG'e çevirir (localStorage'ı şişirmemek için). */
function downscaleImage(file: File, maxDim = 800, quality = 0.6): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width >= height && width > maxDim) {
          height = (height * maxDim) / width;
          width = maxDim;
        } else if (height > maxDim) {
          width = (width * maxDim) / height;
          height = maxDim;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas bağlamı yok.'));
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('Görüntü yüklenemedi.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Dosya okunamadı.'));
    reader.readAsDataURL(file);
  });
}

export default function DeliveryProofModal({
  recipientName,
  onConfirm,
  onCancel,
}: DeliveryProofModalProps) {
  const [tab, setTab] = useState<ProofTab>('SIGNATURE');

  // --- İmza (canvas) ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasSignature, setHasSignature] = useState(false);

  // --- Fotoğraf ---
  const [photoDataUrl, setPhotoDataUrl] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);

  // Canvas'ı görüntülenen boyutuna göre ölçekle (net çizim için).
  useEffect(() => {
    if (tab !== 'SIGNATURE') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#0f172a';
    }
  }, [tab]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const startDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const moveDraw = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!hasSignature) setHasSignature(true);
  };

  const endDraw = () => {
    drawingRef.current = false;
  };

  const clearSignature = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (canvas && ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    setHasSignature(false);
  }, []);

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoError(null);
    try {
      const dataUrl = await downscaleImage(file);
      setPhotoDataUrl(dataUrl);
    } catch {
      setPhotoError('Fotoğraf işlenemedi, tekrar deneyin.');
    }
  };

  const canConfirm =
    tab === 'SIGNATURE' ? hasSignature : Boolean(photoDataUrl);

  const handleConfirm = () => {
    const capturedAt = new Date().toISOString();
    if (tab === 'SIGNATURE') {
      const dataUrl = canvasRef.current?.toDataURL('image/png');
      if (!dataUrl) return;
      onConfirm({ type: 'SIGNATURE', dataUrl, capturedAt });
    } else if (photoDataUrl) {
      onConfirm({ type: 'PHOTO', dataUrl: photoDataUrl, capturedAt });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div className="w-full max-w-md overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        {/* Başlık */}
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Teslimat Kanıtı</h3>
            <p className="text-xs text-slate-500">{recipientName}</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg p-1.5 text-slate-400 active:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sekmeler */}
        <div className="grid grid-cols-2 gap-1 p-3">
          <button
            type="button"
            onClick={() => setTab('SIGNATURE')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === 'SIGNATURE'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <PenLine className="h-4 w-4" />
            Dijital İmza
          </button>
          <button
            type="button"
            onClick={() => setTab('PHOTO')}
            className={`inline-flex items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition ${
              tab === 'PHOTO'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Camera className="h-4 w-4" />
            Fotoğraf Çek
          </button>
        </div>

        <div className="px-4 pb-4">
          {tab === 'SIGNATURE' ? (
            <div>
              <p className="mb-1.5 text-xs text-slate-500">
                Alıcının imzasını aşağıdaki alana parmağınızla/fare ile atın.
              </p>
              <canvas
                ref={canvasRef}
                onPointerDown={startDraw}
                onPointerMove={moveDraw}
                onPointerUp={endDraw}
                onPointerLeave={endDraw}
                className="h-40 w-full touch-none rounded-xl border-2 border-dashed border-slate-300 bg-slate-50"
              />
              <button
                type="button"
                onClick={clearSignature}
                className="mt-2 inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-50"
              >
                <Eraser className="h-3.5 w-3.5" />
                Temizle
              </button>
            </div>
          ) : (
            <div>
              {photoDataUrl ? (
                <div className="space-y-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photoDataUrl}
                    alt="Teslimat fotoğrafı"
                    className="max-h-56 w-full rounded-xl object-contain ring-1 ring-slate-200"
                  />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 active:bg-slate-50">
                    <RefreshCw className="h-3.5 w-3.5" />
                    Yeniden Çek
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handlePhoto}
                      className="hidden"
                    />
                  </label>
                </div>
              ) : (
                <label className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-500 active:bg-slate-100">
                  <Camera className="h-8 w-8" />
                  <span className="text-sm font-medium">
                    Kamerayı Aç / Fotoğraf Seç
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhoto}
                    className="hidden"
                  />
                </label>
              )}
              {photoError && (
                <p className="mt-2 text-xs text-red-600">{photoError}</p>
              )}
            </div>
          )}
        </div>

        {/* Onay */}
        <div className="flex gap-2 border-t border-slate-100 p-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-semibold text-slate-600 active:bg-slate-50"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="inline-flex flex-[2] items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white transition active:bg-emerald-700 disabled:bg-slate-300"
          >
            <Check className="h-5 w-5" />
            Onayla &amp; Teslim Et
          </button>
        </div>
      </div>
    </div>
  );
}
