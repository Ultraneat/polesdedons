export interface Donation {
  id: string;
  title: string;
  category: string; // 'Immobilier', 'Véhicules', 'Financier', 'Matériel', etc.
  description: string;
  status: string;
  target_amount: number | null;
  current_bids_count: number;
  image_url?: string;
  location?: string;
  specifications?: Record<string, string>; // ex: { "Superficie": "120 m²", "Kilométrage": "85 000 km", "État": "Excellent" }
  agent_name?: string;
  agent_phone?: string;
  donor_name?: string;
  views_count?: number;
  created_at: string;
}

export interface Testimonial {
  id: string;
  donation_id: string;
  media_type: "audio" | "video" | "image" | "text";
  railway_media_url?: string;
  author_name: string;
  quote?: string;
  created_at: string;
  approved?: boolean;
}

export interface Application {
  id: string;
  donation_id: string;
  user_id: string;
  user_name: string;
  current_step: number;
  completion_percentage: number;
  rank_position: number;
  risk_level: "low" | "medium" | "high" | "critical";
  step_expires_at: string;
  status: "pending" | "accepted" | "rejected";
  created_at: string;
}

export interface ApplicationSubmission {
  id: string;
  application_id: string;
  step_index: number;
  form_data: Record<string, any>;
  submitted_at: string;
}

export interface ApplicationMessage {
  id: string;
  application_id: string;
  sender_type: "system" | "user" | "admin";
  content: string;
  created_at: string;
  attachment?: {
    name: string;
    url: string;
    size_kb: number;
    type: string;
  };
}

export interface DbStatus {
  connectedToSupabase: boolean;
  supabaseUrl: string;
  localDbStats: {
    donations: number;
    testimonials: number;
    applications: number;
    messages: number;
    submissions: number;
  };
}

export interface WorkflowStep {
  id: string;
  label: string;
  description: string;
  iconName: string; // Ex: 'FileText', 'Sparkles', 'ShieldCheck', 'Mic', 'Truck', 'FileCheck', 'HelpCircle'
  isCustom?: boolean;
  requiredFileType?: "none" | "image" | "pdf" | "any";
  hasTextField?: boolean;
  textFieldLabel?: string;
  textFieldPlaceholder?: string;
  transferModesByCategory?: Record<string, Array<{label: string, desc: string}>>;
}
