#!/bin/sh
set -e

# If Xvfb is available, start virtual display on :99
if which Xvfb > /dev/null 2>&1; then
  echo "🖥️ Starting Xvfb virtual framebuffer display on :99..."
  Xvfb :99 -screen 0 1280x800x24 -nolisten tcp > /dev/null 2>&1 &
  export DISPLAY=:99
  echo "✅ Virtual display ready: DISPLAY=:99"
fi

# Run database push/migrations if DATABASE_URL is set
if [ -n "$DATABASE_URL" ]; then
  echo "🔄 Syncing database schema..."
  case "$DATABASE_URL" in
    postgres*|postgresql*)
      echo "🐘 Detected PostgreSQL connection. Using prisma/schema.postgresql.prisma..."
      npx prisma db push --schema=prisma/schema.postgresql.prisma --skip-generate || true
      npx prisma generate --schema=prisma/schema.postgresql.prisma || true
      ;;
    *)
      echo "🗄️ Detected SQLite/LibSQL connection. Using prisma/schema.prisma..."
      npx prisma db push --schema=prisma/schema.prisma --skip-generate || true
      npx prisma generate --schema=prisma/schema.prisma || true
      ;;
  esac
fi

echo "🚀 Starting application backend..."
exec "$@"
