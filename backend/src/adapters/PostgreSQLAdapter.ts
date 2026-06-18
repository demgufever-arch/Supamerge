import pg from 'pg';
import { BaseAdapter } from './BaseAdapter.js';
import { QueryOptions, QueryResult } from '../types.js';

const { Pool } = pg;

export class PostgreSQLAdapter extends BaseAdapter {
  name = 'PostgreSQL';
  private pool: pg.Pool;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }) {
    super();
    this.pool = new Pool(config);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      return { success: true, message: 'Connected to PostgreSQL' };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }

  async query(table: string, options: QueryOptions): Promise<QueryResult> {
    try {
      let sql = `SELECT * FROM ${this.escapeIdentifier(table)}`;
      let params: any[] = [];
      let paramIndex = 1;

      if (options.where) {
        const conditions = Object.entries(options.where).map(([key, value]) => {
          if (value === null) {
            return `${this.escapeIdentifier(key)} IS NULL`;
          }
          if (Array.isArray(value)) {
            const placeholders = value.map(() => `$${paramIndex++}`).join(',');
            params.push(...value);
            return `${this.escapeIdentifier(key)} IN (${placeholders})`;
          }
          params.push(value);
          return `${this.escapeIdentifier(key)} = $${paramIndex++}`;
        });

        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (options.orderBy) {
        const direction = options.orderDirection === 'desc' ? 'DESC' : 'ASC';
        sql += ` ORDER BY ${this.escapeIdentifier(options.orderBy)} ${direction}`;
      }

      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }

      const result = await this.pool.query(sql, params);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult> {
    try {
      const rows = Array.isArray(data) ? data : [data];
      const keys = Object.keys(rows[0]);
      const columns = keys.map(k => this.escapeIdentifier(k)).join(',');

      const values = rows
        .map((row, rowIndex) => {
          const rowPlaceholders = keys
            .map((_, colIndex) => `$${rowIndex * keys.length + colIndex + 1}`)
            .join(',');
          return `(${rowPlaceholders})`;
        })
        .join(',');

      const params = rows.flatMap(row => keys.map(k => row[k]));

      const sql = `INSERT INTO ${this.escapeIdentifier(table)} (${columns}) VALUES ${values} RETURNING *`;
      const result = await this.pool.query(sql, params);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<QueryResult> {
    try {
      const setClause = Object.keys(data)
        .map((key, index) => `${this.escapeIdentifier(key)} = $${index + 1}`)
        .join(',');

      let params = Object.values(data);
      let paramIndex = params.length + 1;
      let sql = `UPDATE ${this.escapeIdentifier(table)} SET ${setClause}`;

      if (where) {
        const whereConditions = Object.entries(where)
          .map(([key, value]) => {
            params.push(value);
            return `${this.escapeIdentifier(key)} = $${paramIndex++}`;
          })
          .join(' AND ');

        sql += ` WHERE ${whereConditions}`;
      }

      sql += ' RETURNING *';

      const result = await this.pool.query(sql, params);

      return {
        success: true,
        data: result.rows,
        count: result.rows.length,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(table: string, where: Record<string, any>): Promise<QueryResult> {
    try {
      const whereClause = Object.entries(where)
        .map(([key, value], index) => `${this.escapeIdentifier(key)} = $${index + 1}`)
        .join(' AND ');

      const sql = `DELETE FROM ${this.escapeIdentifier(table)} WHERE ${whereClause}`;
      const params = Object.values(where);

      const result = await this.pool.query(sql, params);

      return {
        success: true,
        count: result.rowCount || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async executeRaw(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      const result = await this.pool.query(sql, params);
      return {
        success: true,
        data: result.rows,
        count: result.rowCount || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTables(): Promise<string[]> {
    try {
      const result = await this.pool.query(
        `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`
      );
      return result.rows.map(row => row.table_name);
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }

  async getTableSchema(table: string): Promise<Record<string, any>> {
    try {
      const result = await this.pool.query(
        `SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = $1 AND table_schema = 'public'`,
        [table]
      );

      return result.rows.reduce(
        (acc: any, row: any) => ({
          ...acc,
          [row.column_name]: {
            type: row.data_type,
            nullable: row.is_nullable === 'YES',
          },
        }),
        {}
      );
    } catch (error) {
      console.error('Error getting table schema:', error);
      return {};
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private escapeIdentifier(identifier: string): string {
    return `"${identifier.replace(/"/g, '""')}"`;
  }
}
