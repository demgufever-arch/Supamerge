import { DatabaseAdapter, QueryOptions, QueryResult } from '../types.js';

export abstract class BaseAdapter implements DatabaseAdapter {
  abstract name: string;

  abstract testConnection(): Promise<{ success: boolean; message: string }>;
  abstract query(table: string, options: QueryOptions): Promise<QueryResult>;
  abstract insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult>;
  abstract update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<QueryResult>;
  abstract delete(table: string, where: Record<string, any>): Promise<QueryResult>;
  abstract executeRaw(sql: string, params?: any[]): Promise<QueryResult>;
  abstract getTables(): Promise<string[]>;
  abstract getTableSchema(table: string): Promise<Record<string, any>>;
  abstract close(): Promise<void>;

  // Helper methods
  protected buildWhereClause(where?: Record<string, any>): { clause: string; params: any[] } {
    if (!where || Object.keys(where).length === 0) {
      return { clause: '', params: [] };
    }

    const conditions = Object.entries(where).map(([key, value], index) => {
      if (value === null) {
        return `${key} IS NULL`;
      }
      if (Array.isArray(value)) {
        const placeholders = value.map((_, i) => `$${index * 10 + i + 1}`).join(',');
        return `${key} IN (${placeholders})`;
      }
      return `${key} = $${index + 1}`;
    });

    const params = Object.values(where).flat();
    return {
      clause: conditions.join(' AND '),
      params,
    };
  }

  protected handleError(error: any): QueryResult {
    console.error('Database error:', error);
    return {
      success: false,
      error: error?.message || 'Unknown error occurred',
    };
  }
}
