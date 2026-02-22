// Manual type definitions matching our database schema
// Since the auto-generated types may not be up to date

export interface Customer {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  city: string | null;
  postal_code: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  description: string | null;
  icon: string | null;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  price: number;
  icon: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  product_categories?: ProductCategory;
}

export interface Job {
  id: string;
  customer_id: string;
  title: string;
  description: string | null;
  status: string;
  job_type: string;
  work_address: string | null;
  work_city: string | null;
  work_postal_code: string | null;
  travel_cost: number;
  travel_distance_km: number | null;
  discount_type: string | null;
  discount_value: number;
  extra_costs: number;
  extra_costs_description: string | null;
  advised_price: number | null;
  custom_price: number | null;
  scheduled_date: string | null;
  scheduled_time: string | null;
  is_direct: boolean;
  assigned_to: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

export interface Appointment {
  id: string;
  title: string;
  description: string | null;
  appointment_date: string;
  appointment_time: string | null;
  customer_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer;
}

export interface JobItem {
  id: string;
  job_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  products?: Product;
}

export interface Quote {
  id: string;
  job_id: string;
  quote_number: string | null;
  total_amount: number;
  status: string;
  sent_at: string | null;
  created_at: string;
  updated_at: string;
  jobs?: Job;
}

export interface Invoice {
  id: string;
  job_id: string;
  invoice_number: string | null;
  total_amount: number;
  status: string;
  sent_at: string | null;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
  jobs?: Job;
}

export interface Delivery {
  id: string;
  job_id: string;
  status: string;
  notes: string | null;
  pdf_url: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
  jobs?: Job;
}

export interface DeliveryPhoto {
  id: string;
  delivery_id: string;
  job_item_id: string | null;
  photo_url: string;
  description: string | null;
  created_at: string;
}

export interface ExtraSale {
  id: string;
  job_id: string;
  description: string;
  amount: number;
  created_at: string;
}

export interface Profile {
  id: string;
  user_id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: 'admin' | 'medewerker';
}

export interface Setting {
  id: string;
  key: string;
  value: Record<string, any>;
  updated_at: string;
}

export type JobStatus = 'nieuw' | 'offerte_verstuurd' | 'in_uitvoering' | 'oplevering' | 'gefactureerd' | 'afgerond';
export type JobType = 'producten' | 'ontruiming';
