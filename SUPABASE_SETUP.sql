-- =====================================================================
-- SCRIPT DE CONFIGURATION POUR SUPABASE (AUTH + PROFILES)
-- À exécuter dans le "SQL Editor" de votre tableau de bord Supabase
-- =====================================================================

-- 1. Création de la table 'profiles' pour stocker les métadonnées utilisateurs
-- Cette table est liée à la table interne 'auth.users' de Supabase
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'user', -- 'user', 'admin', 'responsable'
    permissions TEXT[] DEFAULT '{}', -- Les permissions attribuées aux utilisateurs
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- S'assurer que la colonne permissions existe si la table existait déjà
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permissions TEXT[] DEFAULT '{}';

-- 2. Désactiver RLS sur toutes les tables pour permettre la synchronisation et la mise à jour fluide par l'API serveur
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.donations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_submissions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.application_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.testimonials DISABLE ROW LEVEL SECURITY;

-- 3. Politiques de sécurité (RLS)
-- Supprimer d'anciennes politiques problématiques avec récursion infinie
DROP POLICY IF EXISTS "Les admins peuvent tout voir sur profiles" ON public.profiles;
DROP POLICY IF EXISTS "Les utilisateurs peuvent gerer leur propre profil" ON public.profiles;
DROP POLICY IF EXISTS "Lecture publique des profils" ON public.profiles;

-- Politique permettant la lecture publique des profils (évite tout problème de comptage ou d'accès admin depuis l'API serveur)
CREATE POLICY "Lecture publique des profils" 
ON public.profiles FOR SELECT 
USING (true);

-- Les utilisateurs peuvent modifier leur propre profil
CREATE POLICY "Les utilisateurs peuvent modifier leur propre profil" 
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Les administrateurs système peuvent tout faire (insert, update, delete, select)
CREATE POLICY "Les admins peuvent tout gerer sur profiles" 
ON public.profiles FOR ALL 
USING (
    auth.jwt() ->> 'email' IN ('admin@donationsphere.com', 'asthedio@gmail.com')
);

-- 4. TRIGGER : Création automatique d'un profil lors de l'inscription via Auth
-- Cela permet de synchroniser automatiquement les nouveaux inscrits dans votre base de données
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, role)
    VALUES (
        NEW.id, 
        NEW.email, 
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE(NEW.raw_user_meta_data->>'role', 'user')
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Déclenchement du trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =====================================================================
-- AUTRES TABLES REQUISES PAR L'APPLICATION
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    target_amount NUMERIC,
    current_bids_count INT DEFAULT 0,
    image_url TEXT,
    location TEXT,
    specifications JSONB DEFAULT '{}',
    agent_name TEXT,
    agent_phone TEXT,
    donor_name TEXT,
    views_count INT DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES donations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    user_name TEXT NOT NULL,
    current_step INT DEFAULT 0,
    completion_percentage INT DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.application_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    sender_type TEXT,
    content TEXT NOT NULL,
    attachment JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE IF NOT EXISTS public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
