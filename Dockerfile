# syntax=docker/dockerfile:1

# Production image for the Next.js app.
#
#   docker build \
#     --build-arg NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co \
#     --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable-key> \
#     -t mini-lms .
#   docker run -p 3000:3000 mini-lms
#
# The two NEXT_PUBLIC_ values are inlined into the browser bundle at build
# time, so they are build args, not runtime env. Both are public by design
# (Supabase's publishable key is meant for browsers). No secret is needed:
# the app never uses the service-role key.

ARG NODE_VERSION=22

# ---- 1. Install dependencies (cached until package*.json changes) ----------
FROM node:${NODE_VERSION}-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
# --ignore-scripts skips postinstall downloads (e.g. the Supabase CLI binary)
# that the production build doesn't need.
RUN npm ci --ignore-scripts

# ---- 2. Build ---------------------------------------------------------------
FROM node:${NODE_VERSION}-alpine AS builder
WORKDIR /app
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL \
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- 3. Run: only the standalone server and static assets -----------------
FROM node:${NODE_VERSION}-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Run as an unprivileged user.
RUN addgroup -S nodejs -g 1001 && adduser -S nextjs -u 1001 -G nodejs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO /dev/null http://127.0.0.1:3000/auth/login || exit 1

CMD ["node", "server.js"]
