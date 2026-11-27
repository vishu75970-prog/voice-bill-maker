import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface BillItem {
  name: string;
  price: number;
  qty: number;
}

export interface Bill {
  id: string;
  shop_name: string;
  items: BillItem[];
  total: number;
  language: 'hi' | 'en';
  created_at: string;
}
