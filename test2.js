const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://mdftttvjgizzbtevcxkf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1kZnR0dHZqZ2l6emJ0ZXZjeGtmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNzYwODMsImV4cCI6MjA4ODY1MjA4M30.Hgy8wa_nAq6ke09AqIIieuSRTFRcS1DsAUEYWV2JgKU';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function test2() {
  const { data } = await supabase.from('orders').insert([{ status: 'New', is_deleted: null, is_archived: false }]).select();
  console.log("Inserted:", data);
  if (data && data[0]) {
    const id = data[0].id;
    
    const { data: q1 } = await supabase.from('orders').select('id, is_deleted').neq('is_deleted', true).eq('id', id);
    console.log("neq true returned:", q1);
    
    // clean up
    await supabase.from('orders').delete().eq('id', id);
  }
}
test2();
