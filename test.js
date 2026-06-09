const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://mdftttvjgizzbtevcxkf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnR0dHZqZ2l6emJ0ZXZjeGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzYwODMsImV4cCI6MjA4ODY1MjA4M30.Hgy8wa_nAq6ke09AqIIieuSRTFRcS1DsAUEYWV2JgKU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, is_archived, is_deleted')
    .limit(5);
  console.log("Samples:", data, error);

  const { data: q1 } = await supabase
    .from('orders')
    .select('id, is_archived, is_deleted')
    .or('is_archived.is.null,is_archived.eq.false')
    .or('is_deleted.is.null,is_deleted.eq.false');
    
  console.log("Multiple ORs matching count:", q1 ? q1.length : 0);
  
  if (q1) {
    const broken = q1.filter(o => o.is_deleted === true);
    console.log("Broken matches (is_deleted = true):", broken.length);
  }
}
test();
