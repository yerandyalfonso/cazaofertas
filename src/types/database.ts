import type { PriceSource, ProductAvailability } from "@/types";

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          id: string;
          name: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          is_active: boolean;
          created_at: string;
          parent_id: string | null;
          show_in_blog: boolean;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          parent_id?: string | null;
          show_in_blog?: boolean;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          parent_id?: string | null;
          show_in_blog?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey";
            columns: ["parent_id"];
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          asin: string;
          title: string;
          slug: string;
          description: string | null;
          image_url: string | null;
          amazon_url: string;
          affiliate_url: string | null;
          brand: string | null;
          category_id: string | null;
          current_price: number;
          previous_price: number | null;
          lowest_price: number | null;
          highest_price: number | null;
          average_price_30d: number | null;
          average_price_90d: number | null;
          discount_percentage: number | null;
          currency: string;
          availability: ProductAvailability;
          retailer: string;
          external_id: string | null;
          product_url: string | null;
          last_checked_at: string | null;
          out_of_stock_at: string | null;
          last_telegram_notified_at: string | null;
          last_telegram_notified_price: number | null;
          last_telegram_notified_score: number | null;
          deal_expires_at: string | null;
          created_at: string;
          updated_at: string;
          is_active: boolean;
          is_featured: boolean;
        };
        Insert: {
          id?: string;
          asin: string;
          title: string;
          slug: string;
          description?: string | null;
          image_url?: string | null;
          amazon_url: string;
          affiliate_url?: string | null;
          brand?: string | null;
          category_id?: string | null;
          current_price: number;
          previous_price?: number | null;
          lowest_price?: number | null;
          highest_price?: number | null;
          average_price_30d?: number | null;
          average_price_90d?: number | null;
          discount_percentage?: number | null;
          currency?: string;
          availability?: ProductAvailability;
          retailer?: string;
          external_id?: string | null;
          product_url?: string | null;
          last_checked_at?: string | null;
          out_of_stock_at?: string | null;
          last_telegram_notified_at?: string | null;
          last_telegram_notified_price?: number | null;
          last_telegram_notified_score?: number | null;
          deal_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          is_featured?: boolean;
        };
        Update: {
          id?: string;
          asin?: string;
          title?: string;
          slug?: string;
          description?: string | null;
          image_url?: string | null;
          amazon_url?: string;
          affiliate_url?: string | null;
          brand?: string | null;
          category_id?: string | null;
          current_price?: number;
          previous_price?: number | null;
          lowest_price?: number | null;
          highest_price?: number | null;
          average_price_30d?: number | null;
          average_price_90d?: number | null;
          discount_percentage?: number | null;
          currency?: string;
          availability?: ProductAvailability;
          retailer?: string;
          external_id?: string | null;
          product_url?: string | null;
          last_checked_at?: string | null;
          out_of_stock_at?: string | null;
          last_telegram_notified_at?: string | null;
          last_telegram_notified_price?: number | null;
          last_telegram_notified_score?: number | null;
          deal_expires_at?: string | null;
          created_at?: string;
          updated_at?: string;
          is_active?: boolean;
          is_featured?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      price_history: {
        Row: {
          id: string;
          product_id: string;
          price: number;
          timestamp: string;
          source: PriceSource;
        };
        Insert: {
          id?: string;
          product_id: string;
          price: number;
          timestamp?: string;
          source?: PriceSource;
        };
        Update: {
          id?: string;
          product_id?: string;
          price?: number;
          timestamp?: string;
          source?: PriceSource;
        };
        Relationships: [
          {
            foreignKeyName: "price_history_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      users: {
        Row: {
          id: string;
          telegram_id: number | null;
          telegram_username: string | null;
          email: string | null;
          telegram_wizard: Json | null;
          created_at: string;
          last_active_at: string | null;
        };
        Insert: {
          id?: string;
          telegram_id?: number | null;
          telegram_username?: string | null;
          email?: string | null;
          telegram_wizard?: Json | null;
          created_at?: string;
          last_active_at?: string | null;
        };
        Update: {
          id?: string;
          telegram_id?: number | null;
          telegram_username?: string | null;
          email?: string | null;
          telegram_wizard?: Json | null;
          created_at?: string;
          last_active_at?: string | null;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          user_id: string;
          category_id: string | null;
          product_id: string | null;
          brand: string | null;
          keyword: string | null;
          url: string | null;
          last_checked_at: string | null;
          last_known_price: number | null;
          min_discount_percentage: number | null;
          max_price: number | null;
          min_price: number | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          category_id?: string | null;
          product_id?: string | null;
          brand?: string | null;
          keyword?: string | null;
          url?: string | null;
          last_checked_at?: string | null;
          last_known_price?: number | null;
          min_discount_percentage?: number | null;
          max_price?: number | null;
          min_price?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          category_id?: string | null;
          product_id?: string | null;
          brand?: string | null;
          keyword?: string | null;
          url?: string | null;
          last_checked_at?: string | null;
          last_known_price?: number | null;
          min_discount_percentage?: number | null;
          max_price?: number | null;
          min_price?: number | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "alerts_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      channel_notifications: {
        Row: {
          id: string;
          product_id: string;
          score: number;
          old_price: number | null;
          new_price: number;
          discount_percentage: number | null;
          deal_level: string | null;
          status: string;
          telegram_message_id: number | null;
          sent_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          score: number;
          old_price?: number | null;
          new_price: number;
          discount_percentage?: number | null;
          deal_level?: string | null;
          status?: string;
          telegram_message_id?: number | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          score?: number;
          old_price?: number | null;
          new_price?: number;
          discount_percentage?: number | null;
          deal_level?: string | null;
          status?: string;
          telegram_message_id?: number | null;
          sent_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "channel_notifications_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          alert_id: string | null;
          old_price: number | null;
          new_price: number;
          discount_percentage: number | null;
          sent_at: string | null;
          status: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          alert_id?: string | null;
          old_price?: number | null;
          new_price: number;
          discount_percentage?: number | null;
          sent_at?: string | null;
          status?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          product_id?: string;
          alert_id?: string | null;
          old_price?: number | null;
          new_price?: number;
          discount_percentage?: number | null;
          sent_at?: string | null;
          status?: string;
        };
        Relationships: [];
      };
      affiliate_clicks: {
        Row: {
          id: string;
          product_id: string;
          user_id: string | null;
          article_id: string | null;
          source: string;
          is_test: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          product_id: string;
          user_id?: string | null;
          article_id?: string | null;
          source: string;
          is_test?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          product_id?: string;
          user_id?: string | null;
          article_id?: string | null;
          source?: string;
          is_test?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "affiliate_clicks_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "affiliate_clicks_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      articles: {
        Row: {
          id: string;
          title: string;
          slug: string;
          excerpt: string;
          content: Json;
          featured_image: string | null;
          author: string;
          category: string;
          status: string;
          seo_title: string | null;
          seo_description: string | null;
          reading_time: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          slug: string;
          excerpt: string;
          content?: Json;
          featured_image?: string | null;
          author?: string;
          category: string;
          status?: string;
          seo_title?: string | null;
          seo_description?: string | null;
          reading_time?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          title?: string;
          slug?: string;
          excerpt?: string;
          content?: Json;
          featured_image?: string | null;
          author?: string;
          category?: string;
          status?: string;
          seo_title?: string | null;
          seo_description?: string | null;
          reading_time?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      article_comments: {
        Row: {
          id: string;
          article_id: string;
          parent_id: string | null;
          author_name: string;
          author_email: string | null;
          body: string;
          admin_reply: string | null;
          admin_replied_at: string | null;
          status: string;
          notify_on_reply: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          parent_id?: string | null;
          author_name: string;
          author_email?: string | null;
          body: string;
          admin_reply?: string | null;
          admin_replied_at?: string | null;
          status?: string;
          notify_on_reply?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          parent_id?: string | null;
          author_name?: string;
          author_email?: string | null;
          body?: string;
          admin_reply?: string | null;
          admin_replied_at?: string | null;
          status?: string;
          notify_on_reply?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_comments_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
        ];
      };
      article_products: {
        Row: {
          id: string;
          article_id: string;
          product_id: string;
          position: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          article_id: string;
          product_id: string;
          position?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          article_id?: string;
          product_id?: string;
          position?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "article_products_article_id_fkey";
            columns: ["article_id"];
            isOneToOne: false;
            referencedRelation: "articles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "article_products_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      cron_control: {
        Row: {
          id: string;
          paused_until: string | null;
          pause_reason: string | null;
          consecutive_denials: number;
          last_denial_at: string | null;
          last_success_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          paused_until?: string | null;
          pause_reason?: string | null;
          consecutive_denials?: number;
          last_denial_at?: string | null;
          last_success_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          paused_until?: string | null;
          pause_reason?: string | null;
          consecutive_denials?: number;
          last_denial_at?: string | null;
          last_success_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          id: string;
          retailer: string;
          title: string;
          code: string;
          description: string;
          url: string;
          starts_at: string | null;
          expires_at: string | null;
          highlight: boolean;
          source: string;
          is_active: boolean;
          external_id: string | null;
          terms: string | null;
          last_seen_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          retailer: string;
          title: string;
          code: string;
          description?: string;
          url: string;
          starts_at?: string | null;
          expires_at?: string | null;
          highlight?: boolean;
          source?: string;
          is_active?: boolean;
          external_id?: string | null;
          terms?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          retailer?: string;
          title?: string;
          code?: string;
          description?: string;
          url?: string;
          starts_at?: string | null;
          expires_at?: string | null;
          highlight?: boolean;
          source?: string;
          is_active?: boolean;
          external_id?: string | null;
          terms?: string | null;
          last_seen_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      category_keywords: {
        Row: {
          id: string;
          category_id: string;
          keywords: string[];
          breadcrumb_patterns: string[];
          is_active: boolean;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          category_id: string;
          keywords?: string[];
          breadcrumb_patterns?: string[];
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          category_id?: string;
          keywords?: string[];
          breadcrumb_patterns?: string[];
          is_active?: boolean;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "category_keywords_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: true;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      app_settings: {
        Row: {
          id: string;
          telegram_min_score: number;
          miravia_telegram_min_score: number;
          kiabi_telegram_min_score: number;
          telegram_batch_hours: number;
          telegram_flush_reschedule_minutes: number;
          amazon_associate_tag: string | null;
          amazon_flash_insert_limit: number;
          miravia_deals_enabled: boolean;
          miravia_min_discount_percent: number;
          miravia_discovery_max_items: number;
          miravia_flash_limit: number;
          miravia_flash_update_limit: number;
          kiabi_deals_enabled: boolean;
          kiabi_min_discount_percent: number;
          kiabi_discovery_max_items: number;
          kiabi_new_products_only: boolean;
          amazon_flash_feed_urls: string | null;
          miravia_feed_urls: string | null;
          kiabi_feed_urls: string | null;
          amazon_department_feeds_per_run: number;
          miravia_feeds_per_run: number;
          kiabi_feeds_per_run: number;
          telegram_flush_limit: number;
          last_telegram_flush_at: string | null;
          telegram_flush_resume_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          telegram_min_score?: number;
          miravia_telegram_min_score?: number;
          kiabi_telegram_min_score?: number;
          telegram_batch_hours?: number;
          telegram_flush_reschedule_minutes?: number;
          amazon_associate_tag?: string | null;
          amazon_flash_insert_limit?: number;
          miravia_deals_enabled?: boolean;
          miravia_min_discount_percent?: number;
          miravia_discovery_max_items?: number;
          miravia_flash_limit?: number;
          miravia_flash_update_limit?: number;
          kiabi_deals_enabled?: boolean;
          kiabi_min_discount_percent?: number;
          kiabi_discovery_max_items?: number;
          kiabi_new_products_only?: boolean;
          amazon_flash_feed_urls?: string | null;
          miravia_feed_urls?: string | null;
          kiabi_feed_urls?: string | null;
          amazon_department_feeds_per_run?: number;
          miravia_feeds_per_run?: number;
          kiabi_feeds_per_run?: number;
          telegram_flush_limit?: number;
          last_telegram_flush_at?: string | null;
          telegram_flush_resume_at?: string | null;
          updated_at?: string;
        };
        Update: {
          id?: string;
          telegram_min_score?: number;
          miravia_telegram_min_score?: number;
          kiabi_telegram_min_score?: number;
          telegram_batch_hours?: number;
          telegram_flush_reschedule_minutes?: number;
          amazon_associate_tag?: string | null;
          amazon_flash_insert_limit?: number;
          miravia_deals_enabled?: boolean;
          miravia_min_discount_percent?: number;
          miravia_discovery_max_items?: number;
          miravia_flash_limit?: number;
          miravia_flash_update_limit?: number;
          kiabi_deals_enabled?: boolean;
          kiabi_min_discount_percent?: number;
          kiabi_discovery_max_items?: number;
          kiabi_new_products_only?: boolean;
          amazon_flash_feed_urls?: string | null;
          miravia_feed_urls?: string | null;
          kiabi_feed_urls?: string | null;
          amazon_department_feeds_per_run?: number;
          miravia_feeds_per_run?: number;
          kiabi_feeds_per_run?: number;
          telegram_flush_limit?: number;
          last_telegram_flush_at?: string | null;
          telegram_flush_resume_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      deal_level: "NORMAL" | "GOOD_DEAL" | "GREAT_DEAL" | "HISTORICAL_LOW";
      product_availability: ProductAvailability;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type ProductRow = Database["public"]["Tables"]["products"]["Row"];
export type CategoryRow = Database["public"]["Tables"]["categories"]["Row"];
export type PriceHistoryRow =
  Database["public"]["Tables"]["price_history"]["Row"];
export type ArticleRow = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleProductRow =
  Database["public"]["Tables"]["article_products"]["Row"];
export type CouponRow = Database["public"]["Tables"]["coupons"]["Row"];
export type CategoryKeywordRow =
  Database["public"]["Tables"]["category_keywords"]["Row"];
