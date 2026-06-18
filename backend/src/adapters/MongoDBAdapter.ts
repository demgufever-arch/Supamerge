import { MongoClient, Db, Collection } from 'mongodb';
import { BaseAdapter } from './BaseAdapter.js';
import { QueryOptions, QueryResult } from '../types.js';

export class MongoDBAdapter extends BaseAdapter {
  name = 'MongoDB';
  private client: MongoClient;
  private db: Db | null = null;
  private dbName: string;
  private connectionUri: string;

  constructor(connectionUri: string, dbName: string) {
    super();
    this.connectionUri = connectionUri;
    this.dbName = dbName;
    this.client = new MongoClient(connectionUri);
  }

  async connect(): Promise<void> {
    if (!this.db) {
      await this.client.connect();
      this.db = this.client.db(this.dbName);
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    try {
      await this.connect();
      await this.db?.admin().ping();
      return { success: true, message: 'Connected to MongoDB' };
    } catch (error: any) {
      return {
        success: false,
        message: `Failed to connect: ${error.message}`,
      };
    }
  }

  async query(table: string, options: QueryOptions): Promise<QueryResult> {
    try {
      await this.connect();
      const collection = this.db?.collection(table);

      if (!collection) throw new Error('Collection not found');

      let cursor = collection.find(options.where || {});

      if (options.orderBy) {
        const sort: Record<string, 1 | -1> = {};
        sort[options.orderBy] = options.orderDirection === 'desc' ? -1 : 1;
        cursor = cursor.sort(sort);
      }

      if (options.offset) {
        cursor = cursor.skip(options.offset);
      }

      if (options.limit) {
        cursor = cursor.limit(options.limit);
      }

      const data = await cursor.toArray();
      const count = await collection.countDocuments(options.where || {});

      return {
        success: true,
        data,
        count,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async insert(table: string, data: Record<string, any> | Record<string, any>[]): Promise<QueryResult> {
    try {
      await this.connect();
      const collection = this.db?.collection(table);

      if (!collection) throw new Error('Collection not found');

      const docs = Array.isArray(data) ? data : [data];
      const result = await collection.insertMany(docs);

      return {
        success: true,
        data: {
          insertedIds: result.insertedIds,
          insertedCount: result.insertedCount,
        },
        count: result.insertedCount,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async update(table: string, data: Record<string, any>, where?: Record<string, any>): Promise<QueryResult> {
    try {
      await this.connect();
      const collection = this.db?.collection(table);

      if (!collection) throw new Error('Collection not found');

      const result = await collection.updateMany(where || {}, { $set: data });

      return {
        success: true,
        count: result.modifiedCount,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async delete(table: string, where: Record<string, any>): Promise<QueryResult> {
    try {
      await this.connect();
      const collection = this.db?.collection(table);

      if (!collection) throw new Error('Collection not found');

      const result = await collection.deleteMany(where);

      return {
        success: true,
        count: result.deletedCount || 0,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async executeRaw(sql: string, params?: any[]): Promise<QueryResult> {
    try {
      await this.connect();
      // MongoDB doesn't support raw SQL, but we can support aggregation pipeline as JSON
      const pipeline = JSON.parse(sql);
      const collection = this.db?.collection('_default');

      if (!collection) throw new Error('Collection not found');

      const result = await collection.aggregate(pipeline).toArray();

      return {
        success: true,
        data: result,
        count: result.length,
      };
    } catch (error) {
      return this.handleError(error);
    }
  }

  async getTables(): Promise<string[]> {
    try {
      await this.connect();
      const collections = await this.db?.listCollections().toArray();
      return collections?.map(c => c.name) || [];
    } catch (error) {
      console.error('Error getting tables:', error);
      return [];
    }
  }

  async getTableSchema(table: string): Promise<Record<string, any>> {
    try {
      await this.connect();
      const collection = this.db?.collection(table);

      if (!collection) throw new Error('Collection not found');

      const sample = await collection.findOne({});

      if (!sample) return {};

      return Object.entries(sample).reduce(
        (acc, [key, value]) => ({
          ...acc,
          [key]: {
            type: typeof value,
            example: value,
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
    await this.client.close();
    this.db = null;
  }
}
