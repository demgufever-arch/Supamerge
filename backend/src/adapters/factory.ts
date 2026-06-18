import { DatabaseAdapter, DatabaseConfig } from '../types.js';
import { SupabaseAdapter } from './SupabaseAdapter.js';
import { PostgreSQLAdapter } from './PostgreSQLAdapter.js';
import { MySQLAdapter } from './MySQLAdapter.js';
import { MongoDBAdapter } from './MongoDBAdapter.js';

export class AdapterFactory {
  static createAdapter(config: DatabaseConfig): DatabaseAdapter {
    switch (config.type) {
      case 'supabase':
        return new SupabaseAdapter(config.config.url, config.config.anonKey);

      case 'postgresql':
        return new PostgreSQLAdapter({
          host: config.config.host,
          port: config.config.port,
          database: config.config.database,
          user: config.config.user,
          password: config.config.password,
        });

      case 'mysql':
        return new MySQLAdapter({
          host: config.config.host,
          port: config.config.port,
          database: config.config.database,
          user: config.config.user,
          password: config.config.password,
        });

      case 'mongodb':
        return new MongoDBAdapter(config.config.connectionUri, config.config.database);

      default:
        throw new Error(`Unsupported database type: ${config.type}`);
    }
  }
}
