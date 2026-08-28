CREATE TABLE IF NOT EXISTS public.agent_conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id TEXT,
    user_id UUID,
    user_name TEXT,
    sender TEXT,
    sender_type TEXT,
    content TEXT NOT NULL,
    attachment JSONB,
    is_auth BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.agent_conversations DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.application_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    application_id UUID REFERENCES applications(id) ON DELETE CASCADE,
    form_data JSONB NOT NULL,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

ALTER TABLE public.application_submissions DISABLE ROW LEVEL SECURITY;
