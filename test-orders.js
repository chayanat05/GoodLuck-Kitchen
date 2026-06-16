const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mdftttvjgizzbtevcxkf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnR0dHZqZ2l6emJ0ZXZjeGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzYwODMsImV4cCI6MjA4ODY1MjA4M30.Hgy8wa_nAq6ke09AqIIieuSRTFRcS1DsAUEYWV2JgKU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: o, error } = await supabase.from('orders').select('id, status, rider_id, created_at').order('created_at', { ascending: false }).limit(5);
  console.log('Orders:', o);
}
test();