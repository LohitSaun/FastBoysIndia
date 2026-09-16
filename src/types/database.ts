export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      cities: {
        Row: {
          center: unknown
          created_at: string
          id: string
          is_active: boolean
          name: string
          state: string
        }
        Insert: {
          center: unknown
          created_at?: string
          id: string
          is_active?: boolean
          name: string
          state: string
        }
        Update: {
          center?: unknown
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          state?: string
        }
        Relationships: []
      }
      convoy_participants: {
        Row: {
          convoy_id: string
          joined_at: string
          left_at: string | null
          user_id: string
        }
        Insert: {
          convoy_id: string
          joined_at?: string
          left_at?: string | null
          user_id: string
        }
        Update: {
          convoy_id?: string
          joined_at?: string
          left_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "convoy_participants_convoy_id_fkey"
            columns: ["convoy_id"]
            isOneToOne: false
            referencedRelation: "convoys"
            referencedColumns: ["id"]
          },
        ]
      }
      convoys: {
        Row: {
          crew_id: string
          ended_at: string | null
          id: string
          started_at: string
          started_by: string
        }
        Insert: {
          crew_id: string
          ended_at?: string | null
          id?: string
          started_at?: string
          started_by: string
        }
        Update: {
          crew_id?: string
          ended_at?: string | null
          id?: string
          started_at?: string
          started_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "convoys_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crew_members: {
        Row: {
          crew_id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          crew_id: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          crew_id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crew_members_crew_id_fkey"
            columns: ["crew_id"]
            isOneToOne: false
            referencedRelation: "crews"
            referencedColumns: ["id"]
          },
        ]
      }
      crews: {
        Row: {
          city_id: string
          created_at: string
          id: string
          invite_code: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          city_id: string
          created_at?: string
          id?: string
          invite_code?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          city_id?: string
          created_at?: string
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "crews_city_id_fkey"
            columns: ["city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      explored_squares: {
        Row: {
          cell_x: number
          cell_y: number
          first_seen_at: string
          user_id: string
        }
        Insert: {
          cell_x: number
          cell_y: number
          first_seen_at?: string
          user_id: string
        }
        Update: {
          cell_x?: number
          cell_y?: number
          first_seen_at?: string
          user_id?: string
        }
        Relationships: []
      }
      modifications: {
        Row: {
          brand: string | null
          category: string
          created_at: string
          id: string
          installed_on: string | null
          notes: string | null
          title: string
          updated_at: string
          vehicle_id: string
        }
        Insert: {
          brand?: string | null
          category: string
          created_at?: string
          id?: string
          installed_on?: string | null
          notes?: string | null
          title: string
          updated_at?: string
          vehicle_id: string
        }
        Update: {
          brand?: string | null
          category?: string
          created_at?: string
          id?: string
          installed_on?: string | null
          notes?: string | null
          title?: string
          updated_at?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "modifications_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          home_city_id: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          home_city_id?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          home_city_id?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_home_city_id_fkey"
            columns: ["home_city_id"]
            isOneToOne: false
            referencedRelation: "cities"
            referencedColumns: ["id"]
          },
        ]
      }
      trips: {
        Row: {
          created_at: string
          distance_m: number
          duration_s: number
          ended_at: string
          id: string
          max_speed_kph: number | null
          route: unknown
          started_at: string
          user_id: string
          vehicle_id: string | null
        }
        Insert: {
          created_at?: string
          distance_m?: number
          duration_s?: number
          ended_at: string
          id?: string
          max_speed_kph?: number | null
          route?: unknown
          started_at: string
          user_id: string
          vehicle_id?: string | null
        }
        Update: {
          created_at?: string
          distance_m?: number
          duration_s?: number
          ended_at?: string
          id?: string
          max_speed_kph?: number | null
          route?: unknown
          started_at?: string
          user_id?: string
          vehicle_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "trips_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicle_photos: {
        Row: {
          created_at: string
          id: string
          position: number
          storage_path: string
          vehicle_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          position?: number
          storage_path: string
          vehicle_id: string
        }
        Update: {
          created_at?: string
          id?: string
          position?: number
          storage_path?: string
          vehicle_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vehicle_photos_vehicle_id_fkey"
            columns: ["vehicle_id"]
            isOneToOne: false
            referencedRelation: "vehicles"
            referencedColumns: ["id"]
          },
        ]
      }
      vehicles: {
        Row: {
          created_at: string
          id: string
          is_primary: boolean
          make: string
          model: string
          nickname: string | null
          owner_id: string
          updated_at: string
          year: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_primary?: boolean
          make: string
          model: string
          nickname?: string | null
          owner_id: string
          updated_at?: string
          year?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          is_primary?: boolean
          make?: string
          model?: string
          nickname?: string | null
          owner_id?: string
          updated_at?: string
          year?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      my_explored_stats: {
        Row: {
          squares: number | null
          user_id: string | null
        }
        Relationships: []
      }
      my_trip_stats: {
        Row: {
          best_speed_kph: number | null
          total_distance_m: number | null
          total_duration_s: number | null
          trips: number | null
          user_id: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      crew_of_convoy: { Args: { target_convoy_id: string }; Returns: string }
      generate_invite_code: { Args: never; Returns: string }
      is_crew_member: {
        Args: { target_crew_id: string; target_user_id: string }
        Returns: boolean
      }
      is_crew_owner: {
        Args: { target_crew_id: string; target_user_id: string }
        Returns: boolean
      }
      join_crew_by_code: { Args: { code: string }; Returns: string }
      record_trip: {
        Args: {
          p_cells: Json
          p_distance_m: number
          p_duration_s: number
          p_ended_at: string
          p_max_speed_kph: number
          p_route_geojson: Json
          p_started_at: string
          p_vehicle_id: string
        }
        Returns: string
      }
      set_primary_vehicle: {
        Args: { target_vehicle_id: string }
        Returns: undefined
      }
      shares_crew_with: { Args: { other_user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
