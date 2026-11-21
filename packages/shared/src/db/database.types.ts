export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      categories: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      ingredients: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name: string;
          unit: Database['public']['Enums']['ingredient_unit'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name: string;
          unit: Database['public']['Enums']['ingredient_unit'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name?: string;
          unit?: Database['public']['Enums']['ingredient_unit'];
          updated_at?: string;
        };
        Relationships: [];
      };
      inventory_movements: {
        Row: {
          balance_avg_unit_cost: number;
          balance_quantity: number;
          cost_cents: number;
          created_at: string;
          created_by: string | null;
          id: number;
          ingredient_id: string;
          order_id: string | null;
          purchase_id: string | null;
          quantity: number;
          reason: string;
          type: Database['public']['Enums']['inventory_movement_type'];
        };
        ComputedFields: never;
        Insert: {
          balance_avg_unit_cost: number;
          balance_quantity: number;
          cost_cents: number;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          ingredient_id: string;
          order_id?: string | null;
          purchase_id?: string | null;
          quantity: number;
          reason?: string;
          type: Database['public']['Enums']['inventory_movement_type'];
        };
        Update: {
          balance_avg_unit_cost?: number;
          balance_quantity?: number;
          cost_cents?: number;
          created_at?: string;
          created_by?: string | null;
          id?: never;
          ingredient_id?: string;
          order_id?: string | null;
          purchase_id?: string | null;
          quantity?: number;
          reason?: string;
          type?: Database['public']['Enums']['inventory_movement_type'];
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_movements_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'inventory_movements_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
        ];
      };
      inventory_stock: {
        Row: {
          avg_unit_cost: number;
          ingredient_id: string;
          min_quantity: number;
          quantity: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avg_unit_cost?: number;
          ingredient_id: string;
          min_quantity?: number;
          quantity?: number;
          updated_at?: string;
        };
        Update: {
          avg_unit_cost?: number;
          ingredient_id?: string;
          min_quantity?: number;
          quantity?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'inventory_stock_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: true;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          category_id: string;
          created_at: string;
          description: string;
          id: string;
          image_path: string | null;
          is_active: boolean;
          name: string;
          price_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          category_id: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name: string;
          price_cents: number;
          updated_at?: string;
        };
        Update: {
          category_id?: string;
          created_at?: string;
          description?: string;
          id?: string;
          image_path?: string | null;
          is_active?: boolean;
          name?: string;
          price_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey';
            columns: ['category_id'];
            isOneToOne: false;
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string;
          id: string;
          is_active: boolean;
          role: Database['public']['Enums']['app_role'];
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          full_name?: string;
          id: string;
          is_active?: boolean;
          role: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          role?: Database['public']['Enums']['app_role'];
          updated_at?: string;
        };
        Relationships: [];
      };
      purchase_items: {
        Row: {
          cost_cents: number;
          ingredient_id: string;
          purchase_id: string;
          quantity: number;
        };
        ComputedFields: never;
        Insert: {
          cost_cents: number;
          ingredient_id: string;
          purchase_id: string;
          quantity: number;
        };
        Update: {
          cost_cents?: number;
          ingredient_id?: string;
          purchase_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchase_items_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'purchase_items_purchase_id_fkey';
            columns: ['purchase_id'];
            isOneToOne: false;
            referencedRelation: 'purchases';
            referencedColumns: ['id'];
          },
        ];
      };
      purchases: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          note: string;
          purchased_on: string;
          supplier: string;
          total_cents: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          purchased_on: string;
          supplier?: string;
          total_cents: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string;
          purchased_on?: string;
          supplier?: string;
          total_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'purchases_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      recipe_items: {
        Row: {
          ingredient_id: string;
          product_id: string;
          quantity: number;
        };
        ComputedFields: never;
        Insert: {
          ingredient_id: string;
          product_id: string;
          quantity: number;
        };
        Update: {
          ingredient_id?: string;
          product_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'recipe_items_ingredient_id_fkey';
            columns: ['ingredient_id'];
            isOneToOne: false;
            referencedRelation: 'ingredients';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'recipe_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      admin_list_users: {
        Args: { p_user_id?: string };
        Returns: {
          created_at: string;
          email: string;
          full_name: string;
          id: string;
          is_active: boolean;
          last_sign_in_at: string;
          role: Database['public']['Enums']['app_role'];
        }[];
      };
      admin_update_user: {
        Args: {
          p_full_name?: string;
          p_is_active?: boolean;
          p_role?: Database['public']['Enums']['app_role'];
          p_user_id: string;
        };
        Returns: undefined;
      };
      count_stock: {
        Args: { p_counted: number; p_ingredient_id: string; p_reason: string; p_user_id?: string };
        Returns: {
          balance_avg_unit_cost: number;
          balance_quantity: number;
          cost_cents: number;
          created_at: string;
          created_by: string | null;
          id: number;
          ingredient_id: string;
          order_id: string | null;
          purchase_id: string | null;
          quantity: number;
          reason: string;
          type: Database['public']['Enums']['inventory_movement_type'];
        };
        SetofOptions: {
          from: '*';
          to: 'inventory_movements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      create_product: {
        Args: {
          p_category_id: string;
          p_description: string;
          p_is_active: boolean;
          p_name: string;
          p_price_cents: number;
          p_recipe?: Json;
        };
        Returns: string;
      };
      record_waste: {
        Args: { p_ingredient_id: string; p_quantity: number; p_reason: string; p_user_id?: string };
        Returns: {
          balance_avg_unit_cost: number;
          balance_quantity: number;
          cost_cents: number;
          created_at: string;
          created_by: string | null;
          id: number;
          ingredient_id: string;
          order_id: string | null;
          purchase_id: string | null;
          quantity: number;
          reason: string;
          type: Database['public']['Enums']['inventory_movement_type'];
        };
        SetofOptions: {
          from: '*';
          to: 'inventory_movements';
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      register_purchase: {
        Args: {
          p_items: Json;
          p_note: string;
          p_purchased_on: string;
          p_supplier: string;
          p_user_id?: string;
        };
        Returns: string;
      };
      set_product_recipe: { Args: { p_items: Json; p_product_id: string }; Returns: undefined };
    };
    Enums: {
      app_role: 'cajero' | 'cocina' | 'admin';
      ingredient_unit: 'g' | 'ml' | 'unidad';
      inventory_movement_type: 'compra' | 'venta' | 'merma' | 'ajuste' | 'anulacion';
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DefaultSchema['Enums'][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema['CompositeTypes'] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes']
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions['schema']]['CompositeTypes'][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema['CompositeTypes']
    ? DefaultSchema['CompositeTypes'][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ['cajero', 'cocina', 'admin'],
      ingredient_unit: ['g', 'ml', 'unidad'],
      inventory_movement_type: ['compra', 'venta', 'merma', 'ajuste', 'anulacion'],
    },
  },
} as const;
