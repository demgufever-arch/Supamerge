import mysql from 'mysql2/promise';
import { BaseAdapter } from './BaseAdapter.js';
import { QueryOptions, QueryResult } from '../types.js';

export class MySQLAdapter extends BaseAdapter {
  name = 'MySQL';
  private pool: mysql.Pool;

  constructor(config: {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
  }) {
    super();
    this.pool = mysql.createPool(config);
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      const connection = await this.pool.getConnection();
      await connection.ping();
      connection.release();
      return { success: true, message: 'Connected to MySQL' };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }

  async query(table: string, options: QueryOptions): Promise<QueryResult> {
    try {
      let sql = `SELECT * FROM \`${this.escapeIdentifier(table)}\``;
      const params: any[] = [];

      if (options.where) {
        const conditions = Object.entries(options.where).map(([key, value]) => {
          if (value === null) {
            return `\`${this.escapeIdentifier(key)}\` IS NULL`;
          }
          if (Array.isArray(value)) {
            const placeholders = value.map(() => '?').join(',');
            params.push(...value);
            return `\`${this.escapeIdentifier(key)}\` IN (${placeholders})`;
          }
          params.push(value);
          return `\`${this.escapeIdentifier(key)}\` = ?`;
        });

        sql += ` WHERE ${conditions.join(' AND ')}`;
      }

      if (options.orderBy) {
        const direction = options.orderDirection === 'desc' ? 'DESC' : 'ASC';
        sql += ` ORDER BY \`${this.escapeIdentifier(options.orderBy)}\` ${direction}`;
      }

      if (options.limit) {
        sql += ` LIMIT ${options.limit}`;
      }

      if (options.offset) {
        sql += ` OFFSET ${options.offset}`;
      }

      const connection = await this.pool.getConnection();
      const [rows] = await connection.query(sql, params);
      connection.release();

      return {
        success: true,
        data: rows,
        count: Array.isArray(rows) ? rows.length : 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult> {
    try {
      const rows = Array.isArray(data) ? data : [data];
      const keys = Object.keys(rows[0]);
      const columns = keys.map(k => `\`${this.escapeIdentifier(k)}\``).join(',');

      const placeholderRows = rows.map(() => `(${keys.map(() => '?').join(',')})`).join(',');
      const params = rows.flatMap(row => keys.map(k => row[k]));

      const sql = `INSERT INTO \`${this.escapeIdentifier(table)}\` (${columns}) VALUES ${placeholderRows}`;

      const connection = await this.pool.getConnection();
      const [result] = await connection.query(sql, params);
      connection.release();

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
      const setClause = Object.keys(data)
        .map(key => `\`${this.escapeIdentifier(key)}\` = ?`)
        .join(',');

      const params = Object.values(data);
      let sql = `UPDATE \`${this.escapeIdentifier(table)}\` SET ${setClause}`;

      if (where) {
        const whereConditions = Object.keys(where)
          .map(key => `\`${this.escapeIdentifier(key)}\` = ?`)
          .join(' AND ');

        sql += ` WHERE ${whereConditions}`;
        params.push(...Object.values(where));
      }

      const connection = await this.pool.getConnection();
      const [result] = await connection.query(sql, params);
      connection.release();

      return {
        success: true,
        count: (result as any).affectedRows || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(table: string, where: Record<string, any>): Promise<QueryResult> {
    try {
      const whereClause = Object.keys(where)
        .map(key => `\`${this.escapeIdentifier(key)}\` = ?`)
        .join(' AND ');

      const sql = `DELETE FROM \`${this.escapeIdentifier(table)}\` WHERE ${whereClause}`;
      const params = Object.values(where);

      const connection = await this.pool.getConnection();
      const [result] = await connection.query(sql, params);
      connection.release();

      return {
        success: true,
        count: (result as any).affectedRows || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async executeRaw(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      const connection = await this.pool.getConnection();
      const [rows] = await connection.query(sql, params);
      connection.release();

      return {
        success: true,
        data: rows,
        count: Array.isArray(rows) ? rows.length : 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTables(): Promise<string[]> {
    try {
      const connection = await this.pool.getConnection();
      const [rows] = await connection.query(
        `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE()`
      );
      connection.release();

      return (rows as any[]).map(row => row.TABLE_NAME);
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }

  async getTableSchema(table: string): Promise<Record<string, any>> {
    try {
      const connection = await this.pool.getConnection();
      const [rows] = await connection.query(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = ? AND TABLE_SCHEMA = DATABASE()`,
        [table]
      );
      connection.release();

      return (rows as any[]).reduce(
        (acc, row) => ({
          ...acc,
          [row.COLUMN_NAME]: {
            type: row.COLUMN_TYPE,
            nullable: row.IS_NULLABLE === 'YES',
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
    return identifier.replace(/`/g, '``');
  }
}
