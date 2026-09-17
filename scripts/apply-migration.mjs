import fs from 'fs';
import pg from 'pg';
const { Client } = pg;

async function run() {
  const connectionString = 'postgresql://postgres:Kanor%40e2026@[2a05:d018:837:ae00:c249:6cf4:2401:542b]:5432/postgres';
  const client = new Client({ connectionString });
  
  try {
    await client.connect();
    console.log('Connected to database.');
    
    const sql = fs.readFileSync('supabase/migrations/20260917131800_tables.sql', 'utf8');
    console.log(`Loaded SQL file (${sql.length} bytes). Executing...`);
    
    await client.query(sql);
    console.log('Migration executed successfully!');
    
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('Notified PostgREST to reload schema.');
  } catch (err) {
    console.error('Error executing migration:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
