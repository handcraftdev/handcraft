#!/usr/bin/env node

// Script to apply migrations to Supabase
// Usage: node scripts/apply-migrations.js

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to migrations directory
const migrationsDir = path.join(__dirname, '..', 'supabase', 'migrations');

// Get all migration files
const migrationFiles = fs.readdirSync(migrationsDir)
  .filter(file => file.endsWith('.sql'))
  .sort(); // Ensure migrations are applied in order

console.log(`Found ${migrationFiles.length} migration files.`);

// Apply each migration
for (const file of migrationFiles) {
  const filePath = path.join(migrationsDir, file);
  console.log(`Applying migration: ${file}`);
  
  try {
    // Read the SQL file
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Write to a temporary file to avoid command line length issues
    const tempFile = path.join(__dirname, 'temp_migration.sql');
    fs.writeFileSync(tempFile, sql);
    
    // Run the migration using supabase CLI psql
    execSync(`npx supabase db push --debug`, {
      stdio: 'inherit',
    });
    
    // Clean up temp file
    fs.unlinkSync(tempFile);
    
    console.log(`Migration applied successfully: ${file}`);
  } catch (error) {
    console.error(`Error applying migration ${file}:`, error.message);
    process.exit(1);
  }
}

console.log('All migrations applied successfully.');