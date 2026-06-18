import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { BaseAdapter } from './BaseAdapter.js';
import { QueryOptions, QueryResult } from '../types.js';

export class SupabaseAdapter extends BaseAdapter {
  name = 'Supabase';
  private client: SupabaseClient;
  private url: string;
  private key: string;

  constructor(url: string, anonKey: string) {
    super();
    this.url = url;
    this.key = anonKey;
    this.client = createClient(url, anonKey, {
      auth: { persistSession: false },
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const { data, error } = await this.client.from('information_schema.tables').select('*').limit(1);
      if (error) throw error;
      return { success: true, message: 'Connected to Supabase' };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }

  async query(table: string, options: QueryOptions): Promise<QueryResult> {
    try {
      let query = this.client.from(table).select('*');

      if (options.where) {
        Object.entries(options.where).forEach(([key, value]) => {
          if (value === null) {
            query = query.is(key, null);
          } else if (Array.isArray(value)) {
            query = query.in(key, value);
          } else if (typeof value === 'object') {
            query = (query as any).match(key, value);
          } else {
            query = query.eq(key, value);
          }
        });
      }

      if (options.orderBy) {
        query = query.order(options.orderBy, { ascending: options.orderDirection !== 'desc' });
      }

      if (options.limit) {
        query = query.limit(options.limit);
      }

      if (options.offset) {
        query = query.range(options.offset, options.offset + (options.limit || 10) - 1);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        data,
        count: count || data?.length || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult> {
    try {
      const { data: result, error } = await this.client.from(table).insert(data).select();

      if (error) throw error;

      return {
        success: true,
        data: result,
        count: Array.isArray(result) ? result.length : 1,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<QueryResult> {
    try {
      let query = this.client.from(table).update(data);

      if (where) {
        Object.entries(where).forEach(([key, value]) => {
          query = query.eq(key, value);
        });
      }

      const { data: result, error, count } = await query.select();

      if (error) throw error;

      return {
        success: true,
        data: result,
        count: count || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(table: string, where: Record<string, any>): Promise<QueryResult> {
    try {
      let query = this.client.from(table).delete();

      Object.entries(where).forEach(([key, value]) => {
        query = query.eq(key, value);
      });

      const { error, count } = await query;

      if (error) throw error;

      return {
        success: true,
        count: count || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async executeRaw(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      const { data, error } = await this.client.rpc('exec_sql', { query: sql });

      if (error) throw error;

      return {
        success: true,
        data,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTables(): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('information_schema.tables')
        .select('table_name')
        .eq('table_schema', 'public');

      if (error) throw error;

      return data?.map((row: any) => row.table_name) || [];
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }

  async getTableSchema(table: string): Promise<Record<string, any>> {
    try {
      const { data, error } = await this.client
        .from('information_schema.columns')
        .select('column_name, data_type, is_nullable')
        .eq('table_name', table)
        .eq('table_schema', 'public');

      if (error) throw error;

      return data?.reduce(
        (acc, col: any) => ({
          ...acc,
          [col.column_name]: {
            type: col.data_type,
            nullable: col.is_nullable === 'YES',
          },
        }),
        {}
      ) || {};
    } catch (error) {
      console.error('Error getting table schema:', error);
      return {};
    }
  }

  async close(): Promise<void> {
    // Supabase client doesn't need explicit closing
  }
}
