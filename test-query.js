const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://xyzcompany.supabase.co', 'public-anon-key');

const query = supabase
  .from('orders')
  .select('*')
  .eq('branch_id', '123')
  .or('is_archived.is.null,is_archived.eq.false')
  .or('is_deleted.is.null,is_deleted.eq.false');

console.log(query.url.toString());
