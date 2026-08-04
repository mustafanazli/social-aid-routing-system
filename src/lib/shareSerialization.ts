// Canlı paylaşım için rota (de)serileştirme yardımcıları.
//
// Sunucuya taşınan yük (payload) bilinçli olarak sadeleştirilir:
//   - Teslim kanıtı GÖRSELLERİ (imza/fotoğraf base64) SUNUCUYA GİTMEZ; yalnızca
//     "kanıt alındı mı?" bilgisi (hasProof) senkronlanır. Böylece hem yük küçük
//     kalır (Upstash boyut limitleri) hem de kişisel görseller sunucuda tutulmaz.
//   - Şoför ekranının ihtiyaç duymadığı harita geometrisi taşınmaz; navigasyon
//     harici harita uygulamalarına (Google/Yandex) durak noktalarıyla açılır.

import type { GeocodedLocation } from '@/types/address';
import type {
  DeliveryProof,
  StopItem,
  StopStatus,
  VehicleRoute,
} from '@/types/fleet';

/** Paylaşılan tek durak — kanıt görseli olmadan. */
export interface SharedStop {
  stopOrder: number;
  location: GeocodedLocation;
  estimatedArrivalMinutes?: number;
  distanceFromPreviousKm?: number;
  status: StopStatus;
  notes?: string;
  updatedAt?: string;
  /** Teslim kanıtı alındı mı? (görselin kendisi taşınmaz) */
  hasProof?: boolean;
}

/** Paylaşılan araç rotası. */
export interface SharedRoute {
  vehicleId: string;
  vehicleName: string;
  vehicleColor: string;
  assignedCapacity: number;
  totalBoxesAssigned: number;
  totalDistanceKm: number;
  totalDurationMinutes: number;
  stops: SharedStop[];
}

/** Şoförden gelen tek durak güncelleme isteği. */
export interface StopPatch {
  vehicleId: string;
  stopOrder: number;
  status: StopStatus;
  notes?: string;
  /** Kanıt alındıysa true (görsel taşınmaz). */
  hasProof?: boolean;
}

/** Bir aracın (şoförün) canlı konumu. */
export interface DriverLocation {
  vehicleId: string;
  lat: number;
  lng: number;
  updatedAt: string;
}

/** Şoförün "dağıtımı tamamladım" bildirimi + o anki durum özeti. */
export interface RouteCompletion {
  vehicleId: string;
  completedAt: string;
  /** Şoförün isteğe bağlı notu (ör. "3 hane ulaşılamadı"). */
  note?: string;
  delivered: number;
  notHome: number;
  total: number;
}

/** Şoför cihazından gelen "dağıtımı tamamla" isteği. */
export interface RouteCompletionPatch {
  type: 'route-complete';
  vehicleId: string;
  note?: string;
}

/** Tamamlama isteğini araç bazında ekler/günceller (o anki rotadan özet çıkarır). */
export function applyRouteCompletion(
  completions: RouteCompletion[] | undefined,
  patch: RouteCompletionPatch,
  routes: SharedRoute[],
): RouteCompletion[] {
  const base = completions ?? [];
  const stops = routes.find((r) => r.vehicleId === patch.vehicleId)?.stops ?? [];
  const entry: RouteCompletion = {
    vehicleId: patch.vehicleId,
    completedAt: new Date().toISOString(),
    ...(patch.note ? { note: patch.note.slice(0, 300) } : {}),
    delivered: stops.filter((s) => s.status === 'DELIVERED').length,
    notHome: stops.filter((s) => s.status === 'NOT_HOME').length,
    total: stops.length,
  };
  const idx = base.findIndex((c) => c.vehicleId === patch.vehicleId);
  if (idx >= 0) {
    const copy = base.slice();
    copy[idx] = entry;
    return copy;
  }
  return [...base, entry];
}

/** "Dağıtımı tamamla" patch gövdesini doğrular. */
export function isValidRouteCompletionPatch(
  value: unknown,
): value is RouteCompletionPatch {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    v.type === 'route-complete' &&
    typeof v.vehicleId === 'string' &&
    (v.note === undefined || typeof v.note === 'string')
  );
}

/** Şoför cihazından gelen konum güncelleme isteği. */
export interface DriverLocationPatch {
  vehicleId: string;
  lat: number;
  lng: number;
}

/** Konum güncellemesini araç bazında ekler/günceller (mutasyonsuz). */
export function applyDriverLocation(
  locations: DriverLocation[] | undefined,
  patch: DriverLocationPatch,
): DriverLocation[] {
  const base = locations ?? [];
  const entry: DriverLocation = {
    vehicleId: patch.vehicleId,
    lat: patch.lat,
    lng: patch.lng,
    updatedAt: new Date().toISOString(),
  };
  const idx = base.findIndex((d) => d.vehicleId === patch.vehicleId);
  if (idx >= 0) {
    const copy = base.slice();
    copy[idx] = entry;
    return copy;
  }
  return [...base, entry];
}

/** Konum patch gövdesini doğrular (Türkiye kabaca lat 35–43, lng 25–45). */
export function isValidDriverLocationPatch(
  value: unknown,
): value is DriverLocationPatch {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.vehicleId === 'string' &&
    typeof v.lat === 'number' &&
    Number.isFinite(v.lat) &&
    typeof v.lng === 'number' &&
    Number.isFinite(v.lng) &&
    v.lat >= 35 &&
    v.lat <= 43 &&
    v.lng >= 25 &&
    v.lng <= 45
  );
}

/** VehicleRoute[] → paylaşılabilir (görselden arındırılmış) rotalar. */
export function toSharedRoutes(routes: VehicleRoute[]): SharedRoute[] {
  return routes.map((r) => ({
    vehicleId: r.vehicleId,
    vehicleName: r.vehicleName,
    vehicleColor: r.vehicleColor,
    assignedCapacity: r.assignedCapacity,
    totalBoxesAssigned: r.totalBoxesAssigned,
    totalDistanceKm: r.totalDistanceKm,
    totalDurationMinutes: r.totalDurationMinutes,
    stops: r.stops.map(toSharedStop),
  }));
}

function toSharedStop(stop: StopItem): SharedStop {
  return {
    stopOrder: stop.stopOrder,
    location: stop.location,
    estimatedArrivalMinutes: stop.estimatedArrivalMinutes,
    distanceFromPreviousKm: stop.distanceFromPreviousKm,
    status: stop.status,
    notes: stop.notes,
    updatedAt: stop.updatedAt,
    hasProof: Boolean(stop.proof),
  };
}

/**
 * Paylaşılan rotayı, şoför ekranının kullandığı VehicleRoute biçimine çevirir.
 * Kanıt görseli sunucuda tutulmadığından proof alanı burada yeniden kurulmaz;
 * yalnızca yerel (istemci) tarafta anlık gösterim için hasProof korunur.
 */
export function sharedToVehicleRoute(shared: SharedRoute): VehicleRoute {
  return {
    vehicleId: shared.vehicleId,
    vehicleName: shared.vehicleName,
    vehicleColor: shared.vehicleColor,
    assignedCapacity: shared.assignedCapacity,
    totalBoxesAssigned: shared.totalBoxesAssigned,
    totalDistanceKm: shared.totalDistanceKm,
    totalDurationMinutes: shared.totalDurationMinutes,
    stops: shared.stops.map((s) => {
      const stop: StopItem = {
        stopOrder: s.stopOrder,
        location: s.location,
        estimatedArrivalMinutes: s.estimatedArrivalMinutes,
        distanceFromPreviousKm: s.distanceFromPreviousKm,
        status: s.status,
        notes: s.notes,
        updatedAt: s.updatedAt,
      };
      // Kanıt görseli sunucuda yok; ama "alındı" bilgisini görselsiz bir
      // yer tutucuyla koruyoruz ki arayüzde kanıt rozeti görünsün.
      if (s.hasProof) {
        stop.proof = {
          type: 'SIGNATURE',
          dataUrl: '',
          capturedAt: s.updatedAt ?? new Date().toISOString(),
        } satisfies DeliveryProof;
      }
      return stop;
    }),
  };
}

/**
 * Bir durak güncellemesini paylaşılan rotalara uygular ve YENİ dizi döner
 * (mutasyonsuz). Eşleşen durak yoksa değişiklik olmaz.
 */
export function applyStopPatch(
  routes: SharedRoute[],
  patch: StopPatch,
): SharedRoute[] {
  return routes.map((r) =>
    r.vehicleId === patch.vehicleId
      ? {
          ...r,
          stops: r.stops.map((s) =>
            s.stopOrder === patch.stopOrder
              ? {
                  ...s,
                  status: patch.status,
                  notes: patch.notes ?? s.notes,
                  hasProof: patch.hasProof ?? s.hasProof,
                  updatedAt: new Date().toISOString(),
                }
              : s,
          ),
        }
      : r,
  );
}

/** Basit tip doğrulaması — API'ye gelen patch gövdesi için. */
export function isValidStopPatch(value: unknown): value is StopPatch {
  if (!value || typeof value !== 'object') return false;
  const v = value as Record<string, unknown>;
  const validStatus: StopStatus[] = [
    'PENDING',
    'DELIVERED',
    'NOT_HOME',
    'CANCELLED',
  ];
  return (
    typeof v.vehicleId === 'string' &&
    typeof v.stopOrder === 'number' &&
    typeof v.status === 'string' &&
    validStatus.includes(v.status as StopStatus)
  );
}
