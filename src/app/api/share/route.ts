import type { NextRequest } from 'next/server';

import {
  generateShareId,
  putShare,
  isPersistentStore,
} from '@/lib/shareStore';
import {
  toSharedRoutes,
  type SharedRoute,
} from '@/lib/shareSerialization';
import type { VehicleRoute } from '@/types/fleet';

/**
 * Canlı şoför paylaşımı oluşturma uç noktası (POST /api/share).
 *
 * Yönetici panelinde "Canlı Paylaşım Başlat" denince mevcut rotalar (kanıt
 * görselleri arındırılmış olarak) sunucuya kaydedilir ve kısa bir `shareId`
 * döndürülür. Şoför linkleri bu id'yi taşır (`/driver/<araç>?sid=<shareId>`),
 * böylece rota herhangi bir cihazda (telefon) açılabilir.
 *
 * Route Handler'lar Next 16'da varsayılan olarak cache'lenmez; yine de niyeti
 * netleştirmek için dinamik olarak işaretlenir.
 */
export const dynamic = 'force-dynamic';

interface CreateShareBody {
  routes?: VehicleRoute[];
}

export async function POST(request: NextRequest) {
  let body: CreateShareBody;
  try {
    body = (await request.json()) as CreateShareBody;
  } catch {
    return Response.json({ error: 'Geçersiz JSON gövdesi.' }, { status: 400 });
  }

  if (!Array.isArray(body.routes) || body.routes.length === 0) {
    return Response.json(
      { error: 'Paylaşılacak rota bulunamadı.' },
      { status: 400 },
    );
  }

  const shared: SharedRoute[] = toSharedRoutes(body.routes);
  const shareId = generateShareId();
  const now = new Date().toISOString();

  try {
    await putShare(shareId, {
      createdAt: now,
      updatedAt: now,
      routes: shared,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Paylaşım kaydedilemedi.';
    return Response.json({ error: message }, { status: 502 });
  }

  return Response.json({
    shareId,
    persistent: isPersistentStore(),
    createdAt: now,
  });
}
