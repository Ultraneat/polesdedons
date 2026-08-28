-- =====================================================================
-- SCHEMA COMPLET DE BASE DE DONNÉES - PÔLE DE DONS SOLIDAIRES
-- SUPABASE POSTGRESQL (Tables, Colonnes, Index, RLS, Storage & Triggers)
-- PROJET SUPABASE : https://kkcvaklqgacdoxwnsglv.supabase.co
-- =====================================================================

-- 0. EXTENSIONS POSTGRES
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------
-- 1. Table 'profiles' (Profils utilisateurs, rôles et permissions)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(150) NOT NULL DEFAULT 'Utilisateur',
    role VARCHAR(50) NOT NULL DEFAULT 'user', -- 'user', 'admin', 'responsable'
    permissions JSONB DEFAULT '[]'::jsonb, -- ['overview', 'workflow', 'applications', 'publish', 'fields', 'visitor_chats', 'security', 'users']
    avatar_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 2. Table 'donations' (Catalogue complet des dotations et dons)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL, -- 'Véhicules', 'Immobilier', 'Financier', 'Matériel', etc.
    description TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'active', -- 'active', 'completed', 'cancelled', 'draft'
    target_amount NUMERIC(15, 2) DEFAULT NULL,
    current_bids_count INT NOT NULL DEFAULT 0,
    views_count INT NOT NULL DEFAULT 0,
    image_url TEXT DEFAULT NULL,
    location VARCHAR(255) DEFAULT 'France (National)',
    specifications JSONB DEFAULT '{}'::jsonb,
    agent_name VARCHAR(150) DEFAULT 'Secrétariat Général',
    agent_phone VARCHAR(50) DEFAULT '+49 15216945182',
    donor_name VARCHAR(150) DEFAULT 'Anonyme',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 3. Table 'applications' (Dossiers de candidatures / instruction)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES public.donations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name VARCHAR(150) NOT NULL DEFAULT 'Candidat Anonyme',
    user_email VARCHAR(255) DEFAULT NULL,
    user_phone VARCHAR(50) DEFAULT NULL,
    current_step INT NOT NULL DEFAULT 0,
    completion_percentage INT NOT NULL DEFAULT 0,
    rank_position INT NOT NULL DEFAULT 1,
    risk_level VARCHAR(50) NOT NULL DEFAULT 'low', -- 'low', 'medium', 'high', 'critical'
    step_expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '4 hours'),
    status VARCHAR(50) NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'approved', 'rejected', 'cancelled'
    notes TEXT DEFAULT NULL,
    cv_url TEXT DEFAULT NULL,
    id_card_url TEXT DEFAULT NULL,
    address_proof_url TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 4. Table 'application_submissions' (Formulaires des étapes soumises)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    step_index INT NOT NULL,
    form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 5. Table 'application_messages' (Chat interne des dossiers candidats)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES public.applications(id) ON DELETE CASCADE,
    sender_type VARCHAR(50) NOT NULL CHECK (sender_type IN ('system', 'user', 'admin')),
    content TEXT NOT NULL,
    attachment TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 6. Table 'agent_conversations' (Chat direct vitrine / pré-inscription)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES public.donations(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    user_name VARCHAR(150) NOT NULL DEFAULT 'Visiteur',
    sender VARCHAR(50) NOT NULL CHECK (sender IN ('user', 'admin', 'bot', 'system')),
    content TEXT NOT NULL,
    attachment TEXT DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 7. Table 'testimonials' (Témoignages et retours d'attribution)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.testimonials (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES public.donations(id) ON DELETE SET NULL,
    media_type VARCHAR(50) NOT NULL DEFAULT 'image', -- 'audio', 'video', 'image'
    railway_media_url TEXT NOT NULL,
    author_name VARCHAR(150) NOT NULL,
    quote TEXT NOT NULL,
    approved BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 8. Table 'app_settings' (Configuration dynamique du workflow & champs)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.app_settings (
    key VARCHAR(100) PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 9. Table 'chatbot_training' (Base de connaissances du robot d'accueil)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chatbot_training (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    keywords TEXT[] NOT NULL DEFAULT '{}',
    response TEXT NOT NULL,
    is_confidential BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ---------------------------------------------------------------------
-- 10. Table 'partners' (Logos et partenaires officiels)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.partners (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,
    logo_url TEXT NOT NULL,
    website TEXT DEFAULT NULL,
    display_order INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================================
-- INDEX DE PERFORMANCE POUR REQUÊTES RAPIDES
-- =====================================================================
CREATE INDEX IF NOT EXISTS idx_donations_status ON public.donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON public.donations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_applications_donation_id ON public.applications(donation_id);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON public.applications(user_id);
CREATE INDEX IF NOT EXISTS idx_application_submissions_app_id ON public.application_submissions(application_id);
CREATE INDEX IF NOT EXISTS idx_application_messages_app_id ON public.application_messages(application_id);
CREATE INDEX IF NOT EXISTS idx_agent_conversations_don_user ON public.agent_conversations(donation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_testimonials_approved ON public.testimonials(approved);

-- =====================================================================
-- FONCTIONS RPC UTILES (COMPTEURS & TRIGGERS)
-- =====================================================================

-- Fonction RPC pour incrémenter les candidatures sur un don
CREATE OR REPLACE FUNCTION public.increment_bids(donation_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.donations
    SET current_bids_count = COALESCE(current_bids_count, 0) + 1
    WHERE id = donation_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Fonction RPC pour incrémenter les vues sur un don
CREATE OR REPLACE FUNCTION public.increment_views(donation_id_param UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.donations
    SET views_count = COALESCE(views_count, 0) + 1
    WHERE id = donation_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================================
-- ACTIVATION DE LA SÉCURITÉ ROW LEVEL SECURITY (RLS)
-- =====================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chatbot_training ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;

-- =====================================================================
-- POLITIQUES DE SÉCURITÉ RLS DÉTAILLÉES (POLICIES)
-- =====================================================================

-- PROFILES
DROP POLICY IF EXISTS "allow_read_profiles" ON public.profiles;
CREATE POLICY "allow_read_profiles" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_profiles" ON public.profiles;
CREATE POLICY "allow_all_profiles" ON public.profiles FOR ALL USING (true) WITH CHECK (true);

-- DONATIONS
DROP POLICY IF EXISTS "allow_read_donations" ON public.donations;
CREATE POLICY "allow_read_donations" ON public.donations FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_donations" ON public.donations;
CREATE POLICY "allow_all_donations" ON public.donations FOR ALL USING (true) WITH CHECK (true);

-- APPLICATIONS
DROP POLICY IF EXISTS "allow_read_applications" ON public.applications;
CREATE POLICY "allow_read_applications" ON public.applications FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_applications" ON public.applications;
CREATE POLICY "allow_all_applications" ON public.applications FOR ALL USING (true) WITH CHECK (true);

-- APPLICATION_SUBMISSIONS
DROP POLICY IF EXISTS "allow_read_submissions" ON public.application_submissions;
CREATE POLICY "allow_read_submissions" ON public.application_submissions FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_submissions" ON public.application_submissions;
CREATE POLICY "allow_all_submissions" ON public.application_submissions FOR ALL USING (true) WITH CHECK (true);

-- APPLICATION_MESSAGES
DROP POLICY IF EXISTS "allow_read_messages" ON public.application_messages;
CREATE POLICY "allow_read_messages" ON public.application_messages FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_messages" ON public.application_messages;
CREATE POLICY "allow_all_messages" ON public.application_messages FOR ALL USING (true) WITH CHECK (true);

-- AGENT_CONVERSATIONS
DROP POLICY IF EXISTS "allow_read_agent_conversations" ON public.agent_conversations;
CREATE POLICY "allow_read_agent_conversations" ON public.agent_conversations FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_agent_conversations" ON public.agent_conversations;
CREATE POLICY "allow_all_agent_conversations" ON public.agent_conversations FOR ALL USING (true) WITH CHECK (true);

-- TESTIMONIALS
DROP POLICY IF EXISTS "allow_read_testimonials" ON public.testimonials;
CREATE POLICY "allow_read_testimonials" ON public.testimonials FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_testimonials" ON public.testimonials;
CREATE POLICY "allow_all_testimonials" ON public.testimonials FOR ALL USING (true) WITH CHECK (true);

-- APP_SETTINGS
DROP POLICY IF EXISTS "allow_read_settings" ON public.app_settings;
CREATE POLICY "allow_read_settings" ON public.app_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_settings" ON public.app_settings;
CREATE POLICY "allow_all_settings" ON public.app_settings FOR ALL USING (true) WITH CHECK (true);

-- CHATBOT_TRAINING
DROP POLICY IF EXISTS "allow_read_chatbot_training" ON public.chatbot_training;
CREATE POLICY "allow_read_chatbot_training" ON public.chatbot_training FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_chatbot_training" ON public.chatbot_training;
CREATE POLICY "allow_all_chatbot_training" ON public.chatbot_training FOR ALL USING (true) WITH CHECK (true);

-- PARTNERS
DROP POLICY IF EXISTS "allow_read_partners" ON public.partners;
CREATE POLICY "allow_read_partners" ON public.partners FOR SELECT USING (true);

DROP POLICY IF EXISTS "allow_all_partners" ON public.partners;
CREATE POLICY "allow_all_partners" ON public.partners FOR ALL USING (true) WITH CHECK (true);

-- =====================================================================
-- BUCKET DE STOCKAGE SUPABASE (STORAGE)
-- =====================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('donations', 'donations', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Politiques de stockage public
DROP POLICY IF EXISTS "Public Access Donations Bucket" ON storage.objects;
CREATE POLICY "Public Access Donations Bucket"
ON storage.objects FOR SELECT
USING ( bucket_id = 'donations' );

DROP POLICY IF EXISTS "Public Upload Donations Bucket" ON storage.objects;
CREATE POLICY "Public Upload Donations Bucket"
ON storage.objects FOR INSERT
WITH CHECK ( bucket_id = 'donations' );

DROP POLICY IF EXISTS "Public Update Donations Bucket" ON storage.objects;
CREATE POLICY "Public Update Donations Bucket"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'donations' );

DROP POLICY IF EXISTS "Public Delete Donations Bucket" ON storage.objects;
CREATE POLICY "Public Delete Donations Bucket"
ON storage.objects FOR DELETE
USING ( bucket_id = 'donations' );

-- =====================================================================
-- INITIALISATION DES PROFILS ADMINISTRATEURS DE BASE
-- =====================================================================
INSERT INTO public.profiles (email, name, role, permissions)
VALUES 
  ('admin@donationsphere.com', 'Administrateur', 'admin', '["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]'::jsonb),
  ('asthedio@gmail.com', 'Admin Principal', 'admin', '["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]'::jsonb),
  ('asthedio1@gmail.com', 'Admin Principal', 'admin', '["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]'::jsonb)
ON CONFLICT (email) DO UPDATE 
SET role = 'admin', 
    permissions = '["overview", "workflow", "applications", "publish", "fields", "visitor_chats", "security", "users"]'::jsonb;
