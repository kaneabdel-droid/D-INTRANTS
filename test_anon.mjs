import { createClient } from '@supabase/supabase-js'; 
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY); 
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); 
async function run() { 
  const res = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'admin@sunuintrants.sn' }); 
  console.log('GenerateLink Error:', res.error); 
  
  if (res.data && res.data.properties && res.data.properties.hashed_token) {
    const res2 = await anon.auth.verifyOtp({ token_hash: res.data.properties.hashed_token, type: 'magiclink' });
    console.log('VerifyOtp Error:', res2.error);
    if (!res2.error) {
       console.log('VerifyOtp Data:', res2.data.user.email);
    }
  }
} 
run();
