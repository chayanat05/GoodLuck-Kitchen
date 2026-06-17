require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testReset() {
  const { data, error } = await supabase.auth.resetPasswordForEmail('test@example.com', {
    redirectTo: 'http://localhost:3000/reset-password',
  });
  console.log('Data:', data);
  console.log('Error:', error);
}

testReset();