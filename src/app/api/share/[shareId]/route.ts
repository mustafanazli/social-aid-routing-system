import type { NextRequest } from 'next/server';

import { getShare, putShare } from '@/lib/shareStore';
import {
  applyStopPatch,
  isValidStopPatch,
  applyDriverLocation,
  isValidDriverLocationPatch,
} from '@/lib/shareSerialization';

/**
 * Tekil paylaşım uç noktası.
 *   - GET  /api/share/<id>  → paylaşılan rotaları okur (şoför + admin yoklaması).
 *   - PATCH /api/share/<id> → tek bir durağın durumunu günceller (şoför).
 *
 * Canlı senkron için istemci tarafı kısa aralıklarla GET yaparak yoklar
 * (polling); şoför bir teslimatı işaretlediğinde PATCH ile sunucuya yazar.
 */
export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  ctx: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await ctx.params;

  let share;
  try {
    share = await getShare(shareId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Paylaşım okunamadı.';
    return Response.json({ error: message }, { status: 502 });
  }

  if (!share) {
    return Response.json(
      { error: 'Paylaşım bulunamadı veya süresi doldu.' },
      { status: 404 },
    );
  }

  return Response.json({
    routes: share.routes,
    driverLocations: share.driverLocations ?? [],
    createdAt: share.createdAt,
    updatedAt: share.updatedAt,
  });
}

export async function PATCH(
  request: NextRequest,
  ctx: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await ctx.params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 });
  }

  // İki tür güncelleme kabul edilir: (1) şoför konumu, (2) durak durumu.
  const isLocation = isValidDriverLocationPatch(body);
  if (!isLocation && !isValidStopPatch(body)) {
    return Response.json(
      { error: 'Geçersiz güncelleme isteği.' },
      { status: 400 },
    );
  }

  let share;
  try {
    share = await getShare(shareId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Paylaşım okunamadı.';
    return Response.json({ error: message }, { status: 502 });
  }

  if (!share) {
    return Response.json(
      { error: 'Paylaşım bulunamadı veya süresi doldu.' },
      { status: 404 },
    );
  }

  const updatedAt = new Date().toISOString();
  // Diğer alan her iki dalda da korunur (konum güncellemesi durakları,
  // durak güncellemesi konumları silmemeli). Inline tip-guard'lar `body`'yi
  // daraltır.
  let updatedRoutes = share.routes;
  let updatedLocations = share.driverLocations;
  if (isValidDriverLocationPatch(body)) {
    updatedLocations = applyDriverLocation(share.driverLocations, body);
  } else if (isValidStopPatch(body)) {
    updatedRoutes = applyStopPatch(share.routes, body);
  }

  try {
    await putShare(shareId, {
      createdAt: share.createdAt,
      updatedAt,
      routes: updatedRoutes,
      driverLocations: updatedLocations,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Güncelleme kaydedilemedi.';
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({
    routes: updatedRoutes,
    driverLocations: updatedLocations ?? [],
    updatedAt,
  });
}
