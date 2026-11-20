// ตารางของแอป delivery (migration phase 2)
export interface AppStore {
  id: string;
  branch_id: string;
  name: string;
  slug: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
  is_open: boolean;
  sort_index: number;
  delivery_base_fee: number;
  delivery_per_km: number;
  delivery_free_km: number;
  max_delivery_km: number;
  min_order_amount: number;
}

export interface AppStoreMenu {
  id: string;
  store_id: string;
  name: string;
  description: string | null;
  category: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  sort_index: number;
}
