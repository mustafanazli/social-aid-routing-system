import assert from 'node:assert/strict';

import { validateRoutes } from '@/lib/routeValidator';
import type { GeocodedLocation } from '@/types/address';
import type { VehicleRoute, StopItem } from '@/types/fleet';

function stop(order: number, lat: number, lng: number, box = 1): StopItem {
  const loc: GeocodedLocation = {
    id: `s${order}`,
    originalText: '',
    cleanAddress: '',
    neighborhood: '',
    district: 'Pendik',
    city: 'İstanbul',
    recipientName: `Alıcı ${order}`,
    phone: '',
    boxCount: box,
    lat,
    lng,
    geocodingStatus: 'SUCCESS',
  };
  return { stopOrder: order, location: loc, status: 'PENDING' };
}

function route(
  stops: StopItem[],
  capacity: number,
  boxes: number,
): VehicleRoute {
  return {
    vehicleId: 'v1',
    vehicleName: 'Araç 1',
    vehicleColor: '#000',
    assignedCapacity: capacity,
    totalBoxesAssigned: boxes,
    totalDistanceKm: 0,
    totalDurationMinutes: 0,
    stops,
  };
}

// 1) Kapasite aşımı tespiti.
{
  const r = route([stop(1, 40.88, 29.23, 10)], 5, 10);
  const { capacityIssues } = validateRoutes([r]);
  assert.equal(capacityIssues.length, 1);
  assert.equal(capacityIssues[0].overflow, 5);
}

// 2) Pendik merkezinden aşırı sapan adres (Ankara koordinatı) → anomali.
{
  const r = route([stop(1, 39.92, 32.85, 1)], 40, 1); // Ankara
  const { anomalies } = validateRoutes([r]);
  assert.ok(
    anomalies.some((a) => a.reason === 'FAR_FROM_CENTER'),
    'Ankara koordinatı FAR_FROM_CENTER anomalisi olmalı',
  );
}

// 3) İki Pendik durağı arası uzun bacak yok → temiz.
{
  const r = route(
    [stop(1, 40.88, 29.23, 1), stop(2, 40.9, 29.25, 1)],
    40,
    2,
  );
  const { anomalies, hasProblems } = validateRoutes([r]);
  assert.equal(anomalies.length, 0);
  assert.equal(hasProblems, false);
}

// 4) Normal Pendik rotası tamamen temiz.
{
  const r = route([stop(1, 40.875, 29.233, 2)], 40, 2);
  const { hasProblems } = validateRoutes([r]);
  assert.equal(hasProblems, false);
}

console.log('✓ routeValidator.test.ts — 4/4 test geçti');
