FROM node:20-alpine AS base

# Install OpenSSL required by Prisma Engine
RUN apk add --no-cache openssl libc6-compat

# Enable pnpm via Corepack matching root package.json
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

WORKDIR /app

# Copy root configurations & workspace definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.json ./

# Copy packages and apps
COPY packages ./packages
COPY apps ./apps

# Install monorepo dependencies
RUN pnpm install --frozen-lockfile

# Generate Prisma Client & Build all workspace projects
RUN pnpm db:generate
RUN pnpm build

EXPOSE 4000

CMD ["pnpm", "start"]
