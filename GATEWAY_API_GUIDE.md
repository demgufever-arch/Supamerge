# Supabase Gateway API - Complete Implementation Guide

## Overview

We've successfully created a **Unified Database API Gateway** that allows you to:
- Connect to **any database** (Supabase, PostgreSQL, MySQL, MongoDB, etc.)
- Use a **single API key** instead of managing multiple credentials
- Access all databases through a **unified REST API**
- Deploy locally or to production using **Docker**

## Architecture

```
┌─────────────────────────────────────┐
│      SupaMerge Frontend (React)     │
│         (SupaMerge App)              │
└──────────────┬──────────────────────┘
               │ (Single API Key + Bearer Token)
               ↓
┌─────────────────────────────────────┐
│    Gateway API (Node.js/Express)    │
├─────────────────────────────────────┤
│  • API Key Management (JWT + Hash)  │
│  • Database Registry                │
│  • Adapter Factory Pattern          │
└──────────┬──────────────────────────┘
           │
    ┌──────┴──────┬───────────┬────────┐
    ↓             ↓           ↓        ↓
┌────────┐  ┌──────────┐  ┌──────┐ ┌──────┐
│Supabase│  │PostgreSQL│  │MySQL │ │Mongo │
│  APIs  │  │  DB      │  │  DB  │ │  DB  │
└────────┘  └──────────┘  └──────┘ └──────┘
```

## Directory Structure

```
backend/
├── src/
│   ├── adapters/          # Database adapters
│   │   ├── BaseAdapter.ts      # Abstract base class
│   │   ├── SupabaseAdapter.ts  # Supabase implementation
│   │   ├── PostgreSQLAdapter.ts
│   │   ├── MySQLAdapter.ts
│   │   ├── MongoDBAdapter.ts
│   │   └── factory.ts          # Adapter factory
│   ├── utils/
│   │   └── apiKeyManager.ts    # JWT + API key handling
│   ├── types.ts           # TypeScript interfaces
│   └── index.ts           # Main Express server
├── Dockerfile             # Docker image
├── docker-compose.yml     # Docker Compose setup
├── package.json
├── tsconfig.json
├── .env.example
└── README.md
```

## Getting Started

### 1. Local Development

```bash
cd backend

# Install dependencies
npm install

# Create .env from example
cp .env.example .env

# Start development server (watches for changes)
npm run dev

# API will be available at http://localhost:3000
```

### 2. Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up

# API will be available at http://localhost:3000
# Includes PostgreSQL and MongoDB for testing
```

### 3. Production Build

```bash
npm run build

node dist/index.js
```

## Quick Test Guide

### Step 1: Create an API Key

```bash
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"My App"}'

# Response:
# {
#   "id": "uuid",
#   "name": "My App",
#   "key": "sk_xxxxxxxxxxxxx",
#   "message": "Save your API key somewhere safe..."
# }
```

**Save the returned key!** You'll need it to access other endpoints.

### Step 2: Create a JWT Token

```bash
# Using the key from Step 1, get a JWT token
# This is typically done server-to-server
# For testing, you can manually create a JWT

# First, create the API key ID mapping
# Then use APIKeyManager.createToken(keyId)
```

### Step 3: Register a Database

```bash
curl -X POST http://localhost:3000/api/databases \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Production DB",
    "type": "postgresql",
    "config": {
      "host": "localhost",
      "port": 5432,
      "database": "myapp",
      "user": "postgres",
      "password": "password"
    }
  }'

# Response:
# {
#   "id": "db-uuid",
#   "message": "Database registered successfully"
# }
```

### Step 4: Test the Connection

```bash
curl -X POST http://localhost:3000/api/databases/db-uuid/test \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"

# Response:
# {
#   "success": true,
#   "message": "Connected to PostgreSQL"
# }
```

### Step 5: Query Data

```bash
curl "http://localhost:3000/api/databases/db-uuid/query/users?limit=10" \
  -H "Authorization: Bearer <YOUR_JWT_TOKEN>"

# Response:
# {
#   "success": true,
#   "data": [...],
#   "count": 10
# }
```

## Database Configuration Examples

### Supabase

```json
{
  "name": "Supabase Project",
  "type": "supabase",
  "config": {
    "url": "https://your-project.supabase.co",
    "anonKey": "your-anon-key"
  }
}
```

### PostgreSQL

```json
{
  "name": "PostgreSQL Database",
  "type": "postgresql",
  "config": {
    "host": "db.example.com",
    "port": 5432,
    "database": "myapp",
    "user": "postgres",
    "password": "secure-password"
  }
}
```

### MySQL

```json
{
  "name": "MySQL Database",
  "type": "mysql",
  "config": {
    "host": "mysql.example.com",
    "port": 3306,
    "database": "myapp",
    "user": "root",
    "password": "secure-password"
  }
}
```

### MongoDB

```json
{
  "name": "MongoDB Cluster",
  "type": "mongodb",
  "config": {
    "connectionUri": "mongodb+srv://user:password@cluster.mongodb.net/",
    "database": "myapp"
  }
}
```

## API Endpoints Reference

### 🔐 Authentication

All endpoints (except key creation) require:
```
Authorization: Bearer <JWT_TOKEN>
```

### 🔑 API Key Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/keys` | Create a new API key |
| GET | `/api/keys` | List all API keys |
| DELETE | `/api/keys/:id` | Revoke an API key |

### 🗄️ Database Configuration

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/databases` | Register a database |
| GET | `/api/databases` | List all databases |
| POST | `/api/databases/:id/test` | Test connection |
| DELETE | `/api/databases/:id` | Remove a database |
| GET | `/api/databases/:id/tables` | Get all tables |
| GET | `/api/databases/:id/schema/:table` | Get table schema |

### 📊 Data Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/databases/:id/query/:table` | Query data |
| POST | `/api/databases/:id/insert/:table` | Insert data |
| PUT | `/api/databases/:id/update/:table` | Update data |
| DELETE | `/api/databases/:id/delete/:table` | Delete data |

## Query Parameters

### GET `/api/databases/:id/query/:table`

```
?limit=10           # Results per page (default: 10)
&offset=0           # Skip N results (default: 0)
&orderBy=id         # Order by column
&orderDirection=asc # asc or desc (default: asc)
&where={"status":"active"}  # JSON filter conditions
```

Example:
```bash
curl "http://localhost:3000/api/databases/db-123/query/users?limit=20&offset=40&orderBy=created_at&orderDirection=desc&where={\"status\":\"active\"}"
```

## Request/Response Examples

### Insert Single Record

```bash
POST /api/databases/db-id/insert/users
{
  "name": "John Doe",
  "email": "john@example.com"
}

# Response
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "John Doe",
      "email": "john@example.com"
    }
  ],
  "count": 1
}
```

### Insert Multiple Records

```bash
POST /api/databases/db-id/insert/users
[
  { "name": "John Doe", "email": "john@example.com" },
  { "name": "Jane Smith", "email": "jane@example.com" }
]

# Response
{
  "success": true,
  "data": [...],
  "count": 2
}
```

### Update Record

```bash
PUT /api/databases/db-id/update/users
{
  "data": {
    "status": "active",
    "updated_at": "2024-01-01T00:00:00Z"
  },
  "where": {
    "id": 1
  }
}

# Response
{
  "success": true,
  "count": 1
}
```

### Delete Record

```bash
DELETE /api/databases/db-id/delete/users
{
  "where": {
    "id": 1
  }
}

# Response
{
  "success": true,
  "count": 1
}
```

## Environment Variables

```bash
# Server Configuration
PORT=3000
NODE_ENV=development|production

# Security
API_KEY_SECRET=your-secret-key-here  # Change this in production!

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Master Database (optional, for storing configs)
MASTER_DB_TYPE=sqlite|postgresql|mysql
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=gateway_db
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=password
```

## Docker Compose Services

### Running with Docker Compose

```bash
docker-compose up
```

Services included:
- **api** - Express.js gateway (port 3000)
- **postgres** - PostgreSQL database (port 5432)
  - Username: postgres
  - Password: postgres
  - Database: gateway_db
- **mongo** - MongoDB (port 27017)
  - Username: root
  - Password: root

### Test with Docker

```bash
# Create API key
curl -X POST http://localhost:3000/api/keys \
  -H "Content-Type: application/json" \
  -d '{"name":"test"}'

# Register PostgreSQL database
curl -X POST http://localhost:3000/api/databases \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Docker Postgres",
    "type": "postgresql",
    "config": {
      "host": "postgres",
      "port": 5432,
      "database": "gateway_db",
      "user": "postgres",
      "password": "postgres"
    }
  }'
```

## Production Deployment

### AWS ECS

1. Build and push image to ECR
2. Create ECS task definition
3. Deploy with load balancer

### Heroku

```bash
heroku create my-gateway-api
heroku config:set API_KEY_SECRET=your-secret
git push heroku main
```

### Railway

```bash
npm install -g @railway/cli
railway up
```

### DigitalOcean App Platform

Use GitHub integration for automatic deployments

## Security Best Practices

1. **Change API_KEY_SECRET** - Never use the default!
2. **Use HTTPS** - Always in production
3. **Validate Inputs** - Never trust user data
4. **Rate Limiting** - Add rate limits to prevent abuse
5. **Monitor Logs** - Track API usage and errors
6. **Rotate Keys** - Periodically rotate API keys
7. **Use Env Vars** - Never commit secrets to git
8. **Database Permissions** - Use minimal required permissions

## Adapter Extension Guide

Adding a new database type:

```typescript
// 1. Create adapter in src/adapters/YourDBAdapter.ts
import { BaseAdapter } from './BaseAdapter.js';

export class YourDBAdapter extends BaseAdapter {
  name = 'Your Database';
  
  async testConnection() { /* ... */ }
  async query() { /* ... */ }
  async insert() { /* ... */ }
  async update() { /* ... */ }
  async delete() { /* ... */ }
  async executeRaw() { /* ... */ }
  async getTables() { /* ... */ }
  async getTableSchema() { /* ... */ }
  async close() { /* ... */ }
}

// 2. Add to factory in src/adapters/factory.ts
case 'yourdb':
  return new YourDBAdapter(config.config);
```

## Troubleshooting

### Connection Refused
- Check database is running
- Verify host/port in config
- Check firewall rules

### Authentication Failed
- Verify API key exists and is active
- Check JWT token is valid
- Ensure Authorization header format is correct

### Query Errors
- Check table name exists
- Verify column names and types
- Test with simple query first

### CORS Errors
- Update CORS_ORIGIN environment variable
- Include frontend URL in comma-separated list

## Next Steps

1. **Frontend Integration** - Update SupaMerge to use API gateway
2. **Authentication** - Implement proper user management
3. **Caching** - Add Redis for query caching
4. **Monitoring** - Set up logging and monitoring
5. **Testing** - Add comprehensive test suite
6. **Documentation** - Add API documentation UI (Swagger)

## Support & Resources

- Backend README: `backend/README.md`
- API Documentation: `http://localhost:3000/api`
- Health Check: `http://localhost:3000/health`
- GitHub: https://github.com/demgufever-arch/Supamerge

---

**Created by:** Parithosh Varma  
**Part of:** SupaMerge - Unify Your Databases
