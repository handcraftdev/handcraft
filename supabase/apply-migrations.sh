#!/bin/bash

# Get the current directory
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

# Path to the migrations directory
MIGRATIONS_DIR="$DIR/migrations"

# Supabase connection details
SUPABASE_URL="http://127.0.0.1:54321"
SUPABASE_PASSWORD="postgres"
SUPABASE_DB="postgres"
SUPABASE_USER="postgres"
SUPABASE_PORT="54322"

echo "Applying migrations to local Supabase instance..."

# Apply the migration
for file in "$MIGRATIONS_DIR"/*.sql; do
  if [ -f "$file" ]; then
    echo "Applying migration: $(basename "$file")"
    
    # Use PSQL to apply the migration
    PGPASSWORD="$SUPABASE_PASSWORD" psql -h localhost -p "$SUPABASE_PORT" -U "$SUPABASE_USER" -d "$SUPABASE_DB" -f "$file"
    
    if [ $? -eq 0 ]; then
      echo "Migration $(basename "$file") applied successfully."
    else
      echo "Error applying migration $(basename "$file")"
      exit 1
    fi
  fi
done

echo "All migrations applied successfully."