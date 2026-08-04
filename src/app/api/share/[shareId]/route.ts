import type { NextRequest } from 'next/server';

import { getShare, putShare } from '@/lib/shareStore';
import {
  applyStopPatch,
  isValidStopPatch,
  applyDriverLocation,
  isValidDriverLocationPatch,
  applyRouteCompletion,
  isValidRouteCompletionPatch,
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
    completions: share.completions ?? [],
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

  // Üç tür güncelleme kabul edilir: (1) şoför konumu, (2) durak durumu,
  // (3) dağıtımı tamamlama bildirimi.
  if (
    !isValidDriverLocationPatch(body) &&
    !isValidStopPatch(body) &&
    !isValidRouteCompletionPatch(body)
  ) {
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
  // Dokunulmayan alanlar korunur (bir dalın güncellemesi diğerlerini silmemeli).
  // Inline tip-guard'lar `body`'yi daraltır.
  let updatedRoutes = share.routes;
  let updatedLocations = share.driverLocations;
  let updatedCompletions = share.completions;
  if (isValidDriverLocationPatch(body)) {
    updatedLocations = applyDriverLocation(share.driverLocations, body);
  } else if (isValidStopPatch(body)) {
    updatedRoutes = applyStopPatch(share.routes, body);
  } else if (isValidRouteCompletionPatch(body)) {
    updatedCompletions = applyRouteCompletion(
      share.completions,
      body,
      share.routes,
    );
  }

  try {
    await putShare(shareId, {
      createdAt: share.createdAt,
      updatedAt,
      routes: updatedRoutes,
      driverLocations: updatedLocations,
      completions: updatedCompletions,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Güncelleme kaydedilemedi.';
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({
    routes: updatedRoutes,
    driverLocations: updatedLocations ?? [],
    completions: updatedCompletions ?? [],
    updatedAt,
  });
}
