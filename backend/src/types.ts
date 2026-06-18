// Database adapter types
export interface DatabaseConfig {
  id: string;
  name: string;
  type: 'supabase' | 'postgresql' | 'mysql' | 'mongodb' | 'custom';
  config: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  where?: Record<string, any>;
}

export interface QueryResult {
  success: boolean;
  data?: any;
  error?: string;
  count?: number;
}

export interface DatabaseAdapter {
  name: string;
  testConnection(): Promise<{ success: boolean; message: string }>;
  query(table: string, options: QueryOptions): Promise<QueryResult>;
  insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult>;
  update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<QueryResult>;
  delete(table: string, where: Record<string, any>): Promise<QueryResult>;
  executeRaw(sql: string, params?: any[]): Promise<QueryResult>;
  getTables(): Promise<string[]>;
  getTableSchema(table: string): Promise<Record<string, any>>;
  close(): Promise<void>;
}
