const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://mdftttvjgizzbtevcxkf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnR0dHZqZ2l6emJ0ZXZjeGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzYwODMsImV4cCI6MjA4ODY1MjA4M30.Hgy8wa_nAq6ke09AqIIieuSRTFRcS1DsAUEYWV2JgKU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
  const { data: p } = await supabase.from('profiles').select('*').limit(1);
  console.log('Profiles keys:', Object.keys(p[0] || {}));
  const { data: o } = await supabase.from('orders').select('*').limit(1);
  console.log('Orders keys:', Object.keys(o[0] || {}));
  const { data: r } = await supabase.from('rider_attendance').select('*').limit(1);
  console.log('Rider Attendance keys:', Object.keys(r[0] || {}));
}
test();
