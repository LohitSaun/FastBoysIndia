/**
 * TypeScript types for our Supabase database.
 *
 * ⚠️ This file is normally GENERATED from the real database. Don't hand-edit it once
 * the Supabase project is linked. After every migration, regenerate it with:
 *
 *     npm run db:types
 *
 * The Supabase project doesn't exist yet, so this first version was written by hand to
 * match supabase/migrations/*_init_cities_profiles.sql. That lets TypeScript check our
 * queries in the meantime (e.g. a typo like .select('display_nmae') becomes an error).
 */

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      cities: {
        Row: {
          id: string;
          name: string;
          state: string;
          // PostGIS geography(Point) — the generator types these as `unknown`.
          center: unknown;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          name: string;
          state: string;
          center: unknown;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          state?: string;
          center?: unknown;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          home_city_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          home_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          home_city_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'profiles_home_city_id_fkey';
            columns: ['home_city_id'];
            isOneToOne: false;
            referencedRelation: 'cities';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};

/** Shortcut: Tables<'profiles'> is the type of one row in the profiles table. */
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row'];
