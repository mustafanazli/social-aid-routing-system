import assert from 'node:assert/strict';

import { clusterLocations, haversineKm } from '@/lib/clustering';
import type { GeocodedLocation } from '@/types/address';
import type { VehicleConfig } from '@/types/fleet';

function loc(
  id: string,
  lat: number,
  lng: number,
  boxCount: number,
): GeocodedLocation {
  return {
    id,
    originalText: id,
    cleanAddress: id,
    neighborhood: '',
    district: 'Pendik',
    city: 'İstanbul',
    recipientName: id,
    phone: '',
    boxCount,
    lat,
    lng,
    geocodingStatus: 'SUCCESS',
  };
}

function vehicle(id: string, capacity: number): VehicleConfig {
  return { id, name: id, capacity, color: '#000' };
}

// 1) Haversine bilinen mesafe (~ Pendik içi birkaç km).
{
  const d = haversineKm(40.8839, 29.2353, 40.9098, 29.2967);
  assert.ok(d > 4 && d < 8, `beklenen 4-8km, gelen ${d}`);
}

// 2) İki coğrafi küme, iki araç → yakın noktalar aynı araca düşer.
{
  const west = [
    loc('w1', 40.880, 29.230, 2),
    loc('w2', 40.882, 29.232, 2),
    loc('w3', 40.881, 29.229, 2),
  ];
  const east = [
    loc('e1', 40.910, 29.300, 2),
    loc('e2', 40.912, 29.302, 2),
    loc('e3', 40.911, 29.299, 2),
  ];
  const { clusters, overCapacityVehicleIds } = clusterLocations(
    [...west, ...east],
    [vehicle('A', 20), vehicle('B', 20)],
  );
  assert.equal(overCapacityVehicleIds.length, 0, 'kapasite aşımı olmamalı');
  // Her küme 3 noktalı olmalı ve batı/doğu karışmamalı.
  const ids = clusters.map((c) => c.map((l) => l.id[0]).sort().join(''));
  assert.ok(
    ids.includes('www') && ids.includes('eee'),
    `kümeler coğrafi ayrılmadı: ${JSON.stringify(ids)}`,
  );
}

// 3) Kapasite kısıtı: toplam koli kapasiteyi aşarsa taşma işaretlenir.
{
  const pts = [
    loc('p1', 40.88, 29.23, 10),
    loc('p2', 40.881, 29.231, 10),
    loc('p3', 40.882, 29.232, 10),
  ];
  const { overCapacityVehicleIds } = clusterLocations(pts, [
    vehicle('A', 5),
    vehicle('B', 5),
  ]);
  assert.ok(
    overCapacityVehicleIds.length > 0,
    'yetersiz kapasitede taşma bildirilmeli',
  );
}

// 4) Koordinatsız (FAILED) adresler kümelemeye girmez.
{
  const bad: GeocodedLocation = {
    ...loc('x', 0, 0, 1),
    geocodingStatus: 'FAILED',
  };
  const { clusters } = clusterLocations(
    [bad, loc('g', 40.88, 29.23, 1)],
    [vehicle('A', 10)],
  );
  const total = clusters.reduce((s, c) => s + c.length, 0);
  assert.equal(total, 1, 'yalnızca geçerli koordinatlı adres kümelenmeli');
}

console.log('✓ clustering.test.ts — 4/4 test geçti');
