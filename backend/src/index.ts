import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import { APIKeyManager } from './utils/apiKeyManager.js';
import { AdapterFactory } from './adapters/factory.js';
import { DatabaseConfig, DatabaseAdapter, QueryOptions } from './types.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;
const API_KEY_SECRET = process.env.API_KEY_SECRET || 'your-secret-key';

// Middleware
app.use(express.json());
app.use(
  cors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(','),
    credentials: true,
  })
);

// Initialize API Key Manager
const keyManager = new APIKeyManager(API_KEY_SECRET);

// In-memory storage (replace with database for production)
const apiKeys = new Map<string, any>();
const databases = new Map<string, DatabaseConfig>();
const adapters = new Map<string, DatabaseAdapter>();

// Middleware to verify API key
const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const token = keyManager.extractToken(req.headers.authorization);

  if (!token) {
    return res.status(401).json({ error: 'Missing authorization token' });
  }

  const decoded = keyManager.verifyToken(token);
  if (!decoded) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }

  const apiKey = apiKeys.get(decoded.apiKeyId);
  if (!apiKey || !apiKey.isActive) {
    return res.status(401).json({ error: 'API key is inactive' });
  }

  (req as any).apiKeyId = decoded.apiKeyId;
  (req as any).userId = apiKey.userId;
  next();
};

// ============ API Key Management Routes ============

/**
 * Create a new API key
 */
app.post('/api/keys', (req: Request, res: Response) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    const keyId = uuidv4();
    const plainKey = keyManager.generateKey();

    keyManager.hashKey(plainKey).then(hash => {
      apiKeys.set(keyId, {
        id: keyId,
        name,
        keyHash: hash,
        createdAt: new Date(),
        isActive: true,
      });

      res.json({
        id: keyId,
        name,
        key: plainKey, // Only show once during creation
        message: 'Save your API key somewhere safe. You will not see it again!',
      });
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all API keys
 */
app.get('/api/keys', (req: Request, res: Response) => {
  try {
    const keys = Array.from(apiKeys.values()).map(k => ({
      id: k.id,
      name: k.name,
      createdAt: k.createdAt,
      isActive: k.isActive,
    }));

    res.json(keys);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Revoke an API key
 */
app.delete('/api/keys/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const key = apiKeys.get(id);

    if (!key) {
      return res.status(404).json({ error: 'API key not found' });
    }

    key.isActive = false;
    apiKeys.set(id, key);

    res.json({ message: 'API key revoked' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Database Configuration Routes ============

/**
 * Register a database
 */
app.post('/api/databases', authMiddleware, (req: Request, res: Response) => {
  try {
    const { name, type, config } = req.body;

    if (!name || !type || !config) {
      return res.status(400).json({ error: 'Name, type, and config are required' });
    }

    const dbId = uuidv4();
    const dbConfig: DatabaseConfig = {
      id: dbId,
      name,
      type: type as any,
      config,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    databases.set(dbId, dbConfig);

    res.json({
      id: dbId,
      message: 'Database registered successfully',
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * List all registered databases
 */
app.get('/api/databases', authMiddleware, (req: Request, res: Response) => {
  try {
    const dbs = Array.from(databases.values()).map(db => ({
      id: db.id,
      name: db.name,
      type: db.type,
      createdAt: db.createdAt,
    }));

    res.json(dbs);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Test database connection
 */
app.post('/api/databases/:id/test', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const dbConfig = databases.get(id);

    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    const adapter = AdapterFactory.createAdapter(dbConfig);
    const result = await adapter.testConnection();
    await adapter.close();

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Remove a database
 */
app.delete('/api/databases/:id', authMiddleware, (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    if (!databases.has(id)) {
      return res.status(404).json({ error: 'Database not found' });
    }

    // Close adapter if exists
    const adapter = adapters.get(id);
    if (adapter) {
      adapter.close();
      adapters.delete(id);
    }

    databases.delete(id);

    res.json({ message: 'Database removed successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ============ Query Routes ============

/**
 * Query data from a table
 */
app.get('/api/databases/:id/query/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, table } = req.params;
    const options: QueryOptions = {
      limit: req.query.limit ? parseInt(req.query.limit as string) : 10,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
      orderBy: req.query.orderBy as string,
      orderDirection: (req.query.orderDirection as any) || 'asc',
      where: req.query.where ? JSON.parse(req.query.where as string) : undefined,
    };

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const result = await adapter.query(table, options);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Insert data into a table
 */
app.post('/api/databases/:id/insert/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, table } = req.params;
    const data = req.body;

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const result = await adapter.insert(table, data);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update data in a table
 */
app.put('/api/databases/:id/update/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, table } = req.params;
    const { data, where } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required' });
    }

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const result = await adapter.update(table, data, where);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Delete data from a table
 */
app.delete('/api/databases/:id/delete/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, table } = req.params;
    const { where } = req.body;

    if (!where) {
      return res.status(400).json({ error: 'Where clause is required' });
    }

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const result = await adapter.delete(table, where);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get all tables in a database
 */
app.get('/api/databases/:id/tables', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const tables = await adapter.getTables();
    res.json({ tables });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get schema for a table
 */
app.get('/api/databases/:id/schema/:table', authMiddleware, async (req: Request, res: Response) => {
  try {
    const { id, table } = req.params;

    const dbConfig = databases.get(id);
    if (!dbConfig) {
      return res.status(404).json({ error: 'Database not found' });
    }

    let adapter = adapters.get(id);
    if (!adapter) {
      adapter = AdapterFactory.createAdapter(dbConfig);
      adapters.set(id, adapter);
    }

    const schema = await adapter.getTableSchema(table);
    res.json({ schema });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * Health check
 */
app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

/**
 * API documentation
 */
app.get('/api', (req: Request, res: Response) => {
  res.json({
    name: 'Supabase Gateway API',
    version: '1.0.0',
    description: 'Unified Database API Gateway - Connect to any database with a single API key',
    endpoints: {
      'POST /api/keys': 'Create a new API key',
      'GET /api/keys': 'List all API keys',
      'DELETE /api/keys/:id': 'Revoke an API key',
      'POST /api/databases': 'Register a new database',
      'GET /api/databases': 'List all registered databases',
      'POST /api/databases/:id/test': 'Test a database connection',
      'DELETE /api/databases/:id': 'Remove a database',
      'GET /api/databases/:id/query/:table': 'Query data from a table',
      'POST /api/databases/:id/insert/:table': 'Insert data into a table',
      'PUT /api/databases/:id/update/:table': 'Update data in a table',
      'DELETE /api/databases/:id/delete/:table': 'Delete data from a table',
      'GET /api/databases/:id/tables': 'Get all tables in a database',
      'GET /api/databases/:id/schema/:table': 'Get table schema',
    },
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ Supabase Gateway API running on http://localhost:${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
});

export default app;
