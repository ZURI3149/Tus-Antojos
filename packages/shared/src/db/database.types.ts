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
            foreignKeyName: 'inventory_movements_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
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
      order_counters: {
        Row: {
          business_date: string;
          last_number: number;
        };
        ComputedFields: never;
        Insert: {
          business_date: string;
          last_number: number;
        };
        Update: {
          business_date?: string;
          last_number?: number;
        };
        Relationships: [];
      };
      order_events: {
        Row: {
          created_at: string;
          from_status: Database['public']['Enums']['order_status'] | null;
          id: number;
          order_id: string;
          reason: string;
          to_status: Database['public']['Enums']['order_status'];
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          from_status?: Database['public']['Enums']['order_status'] | null;
          id?: never;
          order_id: string;
          reason?: string;
          to_status: Database['public']['Enums']['order_status'];
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          from_status?: Database['public']['Enums']['order_status'] | null;
          id?: never;
          order_id?: string;
          reason?: string;
          to_status?: Database['public']['Enums']['order_status'];
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'order_events_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_events_user_id_fkey';
            columns: ['user_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
      };
      order_items: {
        Row: {
          line_no: number;
          line_total_cents: number;
          note: string;
          order_id: string;
          product_id: string;
          product_name: string;
          promotion_id: string | null;
          promotion_name: string | null;
          quantity: number;
          unit_discount_cents: number;
          unit_price_cents: number;
        };
        ComputedFields: never;
        Insert: {
          line_no: number;
          line_total_cents: number;
          note?: string;
          order_id: string;
          product_id: string;
          product_name: string;
          promotion_id?: string | null;
          promotion_name?: string | null;
          quantity: number;
          unit_discount_cents?: number;
          unit_price_cents: number;
        };
        Update: {
          line_no?: number;
          line_total_cents?: number;
          note?: string;
          order_id?: string;
          product_id?: string;
          product_name?: string;
          promotion_id?: string | null;
          promotion_name?: string | null;
          quantity?: number;
          unit_discount_cents?: number;
          unit_price_cents?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'order_items_order_id_fkey';
            columns: ['order_id'];
            isOneToOne: false;
            referencedRelation: 'orders';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'order_items_promotion_id_fkey';
            columns: ['promotion_id'];
            isOneToOne: false;
            referencedRelation: 'promotions';
            referencedColumns: ['id'];
          },
        ];
      };
      orders: {
        Row: {
          business_date: string;
          cancel_reason: string | null;
          cashier_id: string | null;
          client_order_id: string;
          created_at: string;
          created_offline_at: string | null;
          discount_cents: number;
          id: string;
          order_number: number;
          payment_method: Database['public']['Enums']['payment_method'];
          request_hash: string;
          status: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          total_cents: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          business_date: string;
          cancel_reason?: string | null;
          cashier_id?: string | null;
          client_order_id: string;
          created_at?: string;
          created_offline_at?: string | null;
          discount_cents: number;
          id?: string;
          order_number: number;
          payment_method: Database['public']['Enums']['payment_method'];
          request_hash: string;
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents: number;
          total_cents: number;
          updated_at?: string;
        };
        Update: {
          business_date?: string;
          cancel_reason?: string | null;
          cashier_id?: string | null;
          client_order_id?: string;
          created_at?: string;
          created_offline_at?: string | null;
          discount_cents?: number;
          id?: string;
          order_number?: number;
          payment_method?: Database['public']['Enums']['payment_method'];
          request_hash?: string;
          status?: Database['public']['Enums']['order_status'];
          subtotal_cents?: number;
          total_cents?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'orders_cashier_id_fkey';
            columns: ['cashier_id'];
            isOneToOne: false;
            referencedRelation: 'profiles';
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
      promotion_products: {
        Row: {
          product_id: string;
          promotion_id: string;
        };
        ComputedFields: never;
        Insert: {
          product_id: string;
          promotion_id: string;
        };
        Update: {
          product_id?: string;
          promotion_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'promotion_products_product_id_fkey';
            columns: ['product_id'];
            isOneToOne: false;
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'promotion_products_promotion_id_fkey';
            columns: ['promotion_id'];
            isOneToOne: false;
            referencedRelation: 'promotions';
            referencedColumns: ['id'];
          },
        ];
      };
      promotions: {
        Row: {
          created_at: string;
          created_by: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          kind: Database['public']['Enums']['promotion_kind'];
          name: string;
          starts_at: string;
          updated_at: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind: Database['public']['Enums']['promotion_kind'];
          name: string;
          starts_at: string;
          updated_at?: string;
          value: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: Database['public']['Enums']['promotion_kind'];
          name?: string;
          starts_at?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'promotions_created_by_fkey';
            columns: ['created_by'];
            isOneToOne: false;
            referencedRelation: 'profiles';
            referencedColumns: ['id'];
          },
        ];
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
      advance_order_status: {
        Args: {
          p_order_id: string;
          p_to_status: Database['public']['Enums']['order_status'];
          p_user_id?: string;
        };
        Returns: Json;
      };
      cancel_order: {
        Args: { p_only_cashier?: string; p_order_id: string; p_reason: string; p_user_id?: string };
        Returns: Json;
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
      create_order: {
        Args: {
          p_cashier_id?: string;
          p_client_order_id: string;
          p_created_offline_at?: string;
          p_items: Json;
          p_payment_method: Database['public']['Enums']['payment_method'];
        };
        Returns: Json;
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
      create_promotion: {
        Args: {
          p_ends_at?: string;
          p_kind: Database['public']['Enums']['promotion_kind'];
          p_name: string;
          p_product_ids: string[];
          p_starts_at: string;
          p_user_id?: string;
          p_value: number;
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
      update_promotion: {
        Args: { p_changes: Json; p_id: string; p_product_ids?: string[] };
        Returns: undefined;
      };
    };
    Enums: {
      app_role: 'cajero' | 'cocina' | 'admin';
      ingredient_unit: 'g' | 'ml' | 'unidad';
      inventory_movement_type: 'compra' | 'venta' | 'merma' | 'ajuste' | 'anulacion';
      order_status: 'pendiente' | 'en_preparacion' | 'listo' | 'entregado' | 'anulado';
      payment_method: 'efectivo' | 'qr';
      promotion_kind: 'porcentaje' | 'monto_fijo';
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
      order_status: ['pendiente', 'en_preparacion', 'listo', 'entregado', 'anulado'],
      payment_method: ['efectivo', 'qr'],
      promotion_kind: ['porcentaje', 'monto_fijo'],
    },
  },
} as const;
