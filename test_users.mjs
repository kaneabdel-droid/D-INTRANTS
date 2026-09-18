import { createClient } from '@supabase/supabase-js'; 
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); 
async function run() { 
  const { data, error } = await admin.auth.admin.listUsers();
  console.log(error);
  if (data) {
     console.log(data.users.map(u => u.email));
  }
} 
run();
