CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Prisma creates application tables. Apply infra/postgres/rls.sql after migrations.
-- This bootstrap role is deliberately not a superuser so RLS cannot be bypassed.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'donordesk_app') THEN
    CREATE ROLE donordesk_app LOGIN PASSWORD 'donordesk-app-dev' NOSUPERUSER NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
