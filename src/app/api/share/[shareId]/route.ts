import type { NextRequest } from 'next/server';

import { getShare, putShare } from '@/lib/shareStore';
import { applyStopPatch, isValidStopPatch } from '@/lib/shareSerialization';

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

  if (!isValidStopPatch(body)) {
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

  const updatedRoutes = applyStopPatch(share.routes, body);
  const updatedAt = new Date().toISOString();

  try {
    await putShare(shareId, {
      createdAt: share.createdAt,
      updatedAt,
      routes: updatedRoutes,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Güncelleme kaydedilemedi.';
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({ routes: updatedRoutes, updatedAt });
}
