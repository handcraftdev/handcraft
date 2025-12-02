#!/usr/bin/env node

// Script to test Supabase connection and table access
// Usage: node scripts/test-supabase-connection.js

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from .env.local
function loadEnvFile() {
  const envPath = path.join(__dirname, '..', '.env.local');
  
  if (!fs.existsSync(envPath)) {
    console.error(`.env.local file not found at ${envPath}`);
    return false;
  }
  
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envVars = {};
  
  // Parse each line
  envContent.split('\n').forEach(line => {
    // Skip comments and empty lines
    if (!line || line.startsWith('#')) return;
    
    // Split by first equals sign
    const equalsPos = line.indexOf('=');
    if (equalsPos > 0) {
      const key = line.slice(0, equalsPos).trim();
      let value = line.slice(equalsPos + 1).trim();
      
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      
      envVars[key] = value;
    }
  });
  
  console.log('Loaded environment variables:', Object.keys(envVars).join(', '));
  return envVars;
}

// Main function
async function main() {
  // Load environment variables
  const envVars = loadEnvFile();
  if (!envVars) {
    process.exit(1);
  }
  
  // Get Supabase configuration
  const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = envVars.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase URL or Anonymous Key not found in environment variables.');
    console.log('NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl || '[MISSING]');
    console.log('NEXT_PUBLIC_SUPABASE_ANON_KEY:', supabaseAnonKey ? '[PRESENT]' : '[MISSING]');
    process.exit(1);
  }
  
  console.log('Testing Supabase connection...');
  console.log('URL:', supabaseUrl);
  
  // Create Supabase client
  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  
  // Tables we expect to exist
  const tables = [
    'users',
    'energy',
    'elemental_essences',
    'permissions',
    'transactions',
    'verifications',
    'seasons',
    'player_season_stats',
    'leaderboard_entries',
    'season_rewards',
    'season_transactions'
  ];
  
  // Test each table
  for (const table of tables) {
    await testTableExists(supabase, table);
  }
  
  console.log('\nAll connectivity tests complete!');
}

// Test function for a table
async function testTableExists(supabase, tableName) {
  console.log(`\nTesting access to '${tableName}' table...`);
  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(1);
    
    if (error) {
      console.error(`Error accessing table '${tableName}':`, error);
      return false;
    }
    
    console.log(`Success! Table '${tableName}' is accessible.`);
    if (data && data.length > 0) {
      console.log(`Data sample:`, data);
    } else {
      console.log(`Table is empty.`);
    }
    return true;
  } catch (error) {
    console.error(`Error accessing table '${tableName}':`, error.message);
    return false;
  }
}

// Run the main function
main();