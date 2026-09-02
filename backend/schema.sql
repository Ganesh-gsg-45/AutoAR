-- SQL Schema Migration for Supabase Database
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    amount_paise BIGINT NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    payment_link_id TEXT,
    payment_link_url TEXT
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- Allow public access for Hackathon demo
CREATE POLICY "Allow public read access" ON public.invoices FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON public.invoices FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON public.invoices FOR UPDATE USING (true);
