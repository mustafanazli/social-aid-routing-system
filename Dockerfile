# Pendik Sosyal Yardım Dağıtım & Rota Sistemi — üretim imajı (Next.js standalone).
# Çok aşamalı derleme: bağımlılıklar → derleme → küçük çalışma imajı.

FROM node:22-alpine AS base
# Alpine'da bazı Node yerel eklentileri için gerekli uyumluluk katmanı.
RUN apk add --no-cache libc6-compat
WORKDIR /app

# --- 1) Bağımlılıklar (yalnızca lockfile değişince yeniden çalışır) ---
FROM base AS deps
COPY package.json package-lock.json ./
RUN npm ci

# --- 2) Derleme ---
FROM base AS builder
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# --- 3) Çalışma imajı (yalnızca standalone çıktı + statik dosyalar) ---
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Standalone server.js bu değişkenleri okur; konteynerde tüm arayüzleri dinle.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Root olmayan kullanıcı (güvenlik).
RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

# Statik varlıklar ve standalone sunucu.
COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

# Basit sağlık kontrolü — kök sayfaya HTTP 200.
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
