export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      clients: {
        Row: {
          id: string;
          name: string;
          email: string;
          phone: string | null;
          billing_type: "fixed" | "media_commission" | "auto_cc";
          email_delivery_mode: "combined" | "separate";
          monthly_fee: number | null;
          commission_rate: number | null;
          doc_type: 300 | 305 | 320 | 400;
          invoice_email: string | null;
          report_email: string | null;
          invoice_email_subject: string | null;
          invoice_email_body: string | null;
          ezcount_client_id: string | null;
          ezcount_customer_name: string | null;
          active: boolean;
          automation_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          email: string;
          phone?: string | null;
          billing_type: "fixed" | "media_commission" | "auto_cc";
          email_delivery_mode?: "combined" | "separate";
          monthly_fee?: number | null;
          commission_rate?: number | null;
          doc_type?: 300 | 305 | 320 | 400;
          invoice_email?: string | null;
          report_email?: string | null;
          invoice_email_subject?: string | null;
          invoice_email_body?: string | null;
          ezcount_client_id?: string | null;
          ezcount_customer_name?: string | null;
          active?: boolean;
          automation_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          billing_type?: "fixed" | "media_commission" | "auto_cc";
          email_delivery_mode?: "combined" | "separate";
          monthly_fee?: number | null;
          commission_rate?: number | null;
          doc_type?: 300 | 305 | 320 | 400;
          invoice_email?: string | null;
          report_email?: string | null;
          invoice_email_subject?: string | null;
          invoice_email_body?: string | null;
          ezcount_client_id?: string | null;
          ezcount_customer_name?: string | null;
          active?: boolean;
          automation_active?: boolean;
          notes?: string | null;
          updated_at?: string;
        };
      };

      invoice_line_templates: {
        Row: {
          id: string;
          client_id: string;
          description: string;
          amount: number;
          quantity: number;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          description: string;
          amount: number;
          quantity?: number;
          sort_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          description?: string;
          amount?: number;
          quantity?: number;
          sort_order?: number;
        };
      };

      invoice_drafts: {
        Row: {
          id: string;
          client_id: string;
          status:
            | "pending_review"
            | "approved"
            | "sent"
            | "failed"
            | "skipped"
            | "invoiced_pending_combined"
            | "invoiced_email_failed";
          billing_month: string;
          line_items: Json;
          subtotal: number;
          vat: number;
          total: number;
          doc_type: 300 | 305 | 320 | 400;
          ezcount_doc_number: string | null;
          ezcount_doc_url: string | null;
          approved_at: string | null;
          sent_at: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          status?:
            | "pending_review"
            | "approved"
            | "sent"
            | "failed"
            | "skipped"
            | "invoiced_pending_combined"
            | "invoiced_email_failed";
          billing_month: string;
          line_items?: Json;
          subtotal?: number;
          vat?: number;
          total?: number;
          doc_type: 300 | 305 | 320 | 400;
          ezcount_doc_number?: string | null;
          ezcount_doc_url?: string | null;
          approved_at?: string | null;
          sent_at?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          status?:
            | "pending_review"
            | "approved"
            | "sent"
            | "failed"
            | "skipped"
            | "invoiced_pending_combined"
            | "invoiced_email_failed";
          billing_month?: string;
          line_items?: Json;
          subtotal?: number;
          vat?: number;
          total?: number;
          doc_type?: 300 | 305 | 320 | 400;
          ezcount_doc_number?: string | null;
          ezcount_doc_url?: string | null;
          approved_at?: string | null;
          sent_at?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
      };

      invoices_sent: {
        Row: {
          id: string;
          client_id: string;
          draft_id: string | null;
          billing_month: string;
          doc_type: 300 | 305 | 320 | 400;
          doc_number: string;
          doc_url: string | null;
          subtotal: number;
          vat: number;
          total: number;
          sent_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          draft_id?: string | null;
          billing_month: string;
          doc_type: 300 | 305 | 320 | 400;
          doc_number: string;
          doc_url?: string | null;
          subtotal: number;
          vat: number;
          total: number;
          sent_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          draft_id?: string | null;
          billing_month?: string;
          doc_type?: 300 | 305 | 320 | 400;
          doc_number?: string;
          doc_url?: string | null;
          subtotal?: number;
          vat?: number;
          total?: number;
          sent_at?: string;
        };
      };

      email_log: {
        Row: {
          id: string;
          client_id: string | null;
          draft_id: string | null;
          email_type: "monthly_report" | "invoice" | "combined" | "media_invoices" | "manual";
          to_email: string;
          subject: string;
          status: "sent" | "failed";
          error_message: string | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          draft_id?: string | null;
          email_type: "monthly_report" | "invoice" | "combined" | "media_invoices" | "manual";
          to_email: string;
          subject: string;
          status: "sent" | "failed";
          error_message?: string | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          draft_id?: string | null;
          email_type?: "monthly_report" | "invoice" | "combined" | "media_invoices" | "manual";
          to_email?: string;
          subject?: string;
          status?: "sent" | "failed";
          error_message?: string | null;
          sent_at?: string | null;
        };
      };

      ads_invoices: {
        Row: {
          id: string;
          client_id: string;
          billing_month: string;
          platform: "google_ads" | "facebook_ads";
          spend_amount: number;
          commission_rate: number;
          commission_amount: number;
          vat: number;
          total: number;
          doc_number: string | null;
          status: "pending" | "invoiced";
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          billing_month: string;
          platform: "google_ads" | "facebook_ads";
          spend_amount: number;
          commission_rate: number;
          commission_amount: number;
          vat: number;
          total: number;
          doc_number?: string | null;
          status?: "pending" | "invoiced";
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          billing_month?: string;
          platform?: "google_ads" | "facebook_ads";
          spend_amount?: number;
          commission_rate?: number;
          commission_amount?: number;
          vat?: number;
          total?: number;
          doc_number?: string | null;
          status?: "pending" | "invoiced";
          updated_at?: string;
        };
      };

      app_settings: {
        Row: {
          id: 1;
          ezcount_api_key: string;
          ezcount_api_email: string;
          gmail_refresh_token: string | null;
          vat_rate: number;
          report_send_day: number;
          invoice_generate_day: number;
          invoice_email_subject: string | null;
          invoice_email_body: string | null;
          cron_secret: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: 1;
          ezcount_api_key?: string;
          ezcount_api_email?: string;
          gmail_refresh_token?: string | null;
          vat_rate?: number;
          report_send_day?: number;
          invoice_generate_day?: number;
          invoice_email_subject?: string | null;
          invoice_email_body?: string | null;
          cron_secret?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          ezcount_api_key?: string;
          ezcount_api_email?: string;
          gmail_refresh_token?: string | null;
          vat_rate?: number;
          report_send_day?: number;
          invoice_generate_day?: number;
          invoice_email_subject?: string | null;
          invoice_email_body?: string | null;
          cron_secret?: string | null;
          updated_at?: string;
        };
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}

// Convenience row types
export type ClientRow = Database["public"]["Tables"]["clients"]["Row"];
export type ClientInsert = Database["public"]["Tables"]["clients"]["Insert"];
export type ClientUpdate = Database["public"]["Tables"]["clients"]["Update"];

export type LineTemplateRow = Database["public"]["Tables"]["invoice_line_templates"]["Row"];
export type LineTemplateInsert = Database["public"]["Tables"]["invoice_line_templates"]["Insert"];
export type LineTemplateUpdate = Database["public"]["Tables"]["invoice_line_templates"]["Update"];

export type DraftRow = Database["public"]["Tables"]["invoice_drafts"]["Row"];
export type DraftInsert = Database["public"]["Tables"]["invoice_drafts"]["Insert"];
export type DraftUpdate = Database["public"]["Tables"]["invoice_drafts"]["Update"];

export type InvoiceSentRow = Database["public"]["Tables"]["invoices_sent"]["Row"];
export type InvoiceSentInsert = Database["public"]["Tables"]["invoices_sent"]["Insert"];

export type EmailLogRow = Database["public"]["Tables"]["email_log"]["Row"];
export type EmailLogInsert = Database["public"]["Tables"]["email_log"]["Insert"];

export type AdsInvoiceRow = Database["public"]["Tables"]["ads_invoices"]["Row"];
export type AdsInvoiceInsert = Database["public"]["Tables"]["ads_invoices"]["Insert"];
export type AdsInvoiceUpdate = Database["public"]["Tables"]["ads_invoices"]["Update"];

export type AppSettingsRow = Database["public"]["Tables"]["app_settings"]["Row"];
export type AppSettingsUpdate = Database["public"]["Tables"]["app_settings"]["Update"];
