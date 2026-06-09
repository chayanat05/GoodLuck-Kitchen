const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://mdftttvjgizzbtevcxkf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnR0dHZqZ2l6emJ0ZXZjeGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzYwODMsImV4cCI6MjA4ODY1MjA4M30.Hgy8wa_nAq6ke09AqIIieuSRTFRcS1DsAUEYWV2JgKU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test3() {
  const { data: q1, error } = await supabase.from('orders').select('id, is_deleted').not('is_deleted', 'is', true).limit(1);
  console.log("not is true:", q1, error);
}
test3();
