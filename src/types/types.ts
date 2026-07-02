export interface Order {
  id: string;
  created_at: string;
  branch_id: string;
  order_number: string;
  status: string;
  job_type: string;
  
  menu?: string | null;
  details?: string | null;
  
  customer_name?: string | null;
  // This can be the location name from Google Maps or a saved location
  address?: string | null; 
  lat?: number | null;
  lng?: number | null;
  
  total_price?: number | null;
  delivery_fee?: number | null;
  payment_method?: string | null;
  
  contact_source?: string | null;
  contact_link?: string | null;
  
  // General order images attached by admin/staff
  image_url?: string | null; 
  // Payment slip images, can be multiple, comma-separated
  slip_image?: string | null; 
  
  rider_name?: string | null;
  
  sort_index?: number | null;
  
  is_archived?: boolean | null;
  is_deleted?: boolean | null;
  deleted_at?: string | null;
  end_time?: string | null;
}
