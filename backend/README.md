# Supabase Gateway API

🚀 **Unified Database API Gateway** - Connect to any database with a single API key

A powerful backend API that acts as a gateway to multiple databases (Supabase, PostgreSQL, MySQL, MongoDB, and more). Instead of managing multiple database connections and API keys in your frontend, use a single API key to access all your databases securely.

## Features

- 🔐 **Single API Key** - One key to access all configured databases
- 🗄️ **Multi-Database Support** - Supabase, PostgreSQL, MySQL, MongoDB
- 🔌 **Easy Integration** - Simple REST API endpoints
- 🛡️ **Secure** - JWT-based authentication, API key hashing
- 🐳 **Docker Ready** - Containerized deployment included
- 📊 **Full CRUD** - Query, insert, update, delete operations
- 🔍 **Schema Introspection** - Explore tables and schemas
- ⚡ **Production Ready** - Error handling, connection pooling

## Quick Start

### Local Development

```bash
# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Start development server
npm run dev

# API will be available at http://localhost:3000
```

### Docker Deployment

```bash
# Build and run with Docker Compose
docker-compose up

# API will be available at http://localhost:3000
```

## API Endpoints

### Authentication

All endpoints (except `/api/keys` creation) require a Bearer token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

### API Key Management

#### Create API Key
```bash
POST /api/keys
Content-Type: application/json

{
  "name": "My Frontend App"
}

# Response
{
  "id": "uuid",
  "name": "My Frontend App",
  "key": "sk_xxxxxxxxxxxxx",  # Save this! Only shown once
  "message": "Save your API key somewhere safe..."
}
```

#### List API Keys
```bash
GET /api/keys
```

#### Revoke API Key
```bash
DELETE /api/keys/:id
```

### Database Management

#### Register a Database
```bash
POST /api/databases
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "Production DB",
  "type": "postgresql",
  "config": {
    "host": "localhost",
    "port": 5432,
    "database": "myapp",
    "user": "postgres",
    "password": "password"
  }
}
```

**Supported database types:**
- `supabase` - Supabase project
- `postgresql` - PostgreSQL
- `mysql` - MySQL/MariaDB
- `mongodb` - MongoDB

#### List Databases
```bash
GET /api/databases
Authorization: Bearer <token>
```

#### Test Database Connection
```bash
POST /api/databases/:id/test
Authorization: Bearer <token>
```

#### Get All Tables
```bash
GET /api/databases/:id/tables
Authorization: Bearer <token>
```

#### Get Table Schema
```bash
GET /api/databases/:id/schema/:table
Authorization: Bearer <token>
```

#### Remove Database
```bash
DELETE /api/databases/:id
Authorization: Bearer <token>
```

### Data Operations

#### Query Data
```bash
GET /api/databases/:id/query/:table?limit=10&offset=0&orderBy=id&orderDirection=desc&where={"status":"active"}
Authorization: Bearer <token>
```

#### Insert Data
```bash
POST /api/databases/:id/insert/:table
Authorization: Bearer <token>
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com"
}

# Or insert multiple rows
[
  { "name": "John", "email": "john@example.com" },
  { "name": "Jane", "email": "jane@example.com" }
]
```

#### Update Data
```bash
PUT /api/databases/:id/update/:table
Authorization: Bearer <token>
Content-Type: application/json

{
  "data": {
    "status": "active"
  },
  "where": {
    "id": 123
  }
}
```

#### Delete Data
```bash
DELETE /api/databases/:id/delete/:table
Authorization: Bearer <token>
Content-Type: application/json

{
  "where": {
    "id": 123
  }
}
```

## Configuration

### Environment Variables

```bash
# Server
PORT=3000
NODE_ENV=development

# Security
API_KEY_SECRET=your-super-secret-key-change-this

# CORS
CORS_ORIGIN=http://localhost:5173,http://localhost:3000

# Optional: Use PostgreSQL as master database
MASTER_DB_TYPE=postgresql
MASTER_DB_HOST=localhost
MASTER_DB_PORT=5432
MASTER_DB_NAME=gateway_db
MASTER_DB_USER=postgres
MASTER_DB_PASSWORD=postgres
```

## Usage Example

### Frontend Integration

```javascript
// Create API key
const keyResponse = await fetch('http://localhost:3000/api/keys', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'My App' })
});
const { id, key } = await keyResponse.json();

// Save key securely (e.g., backend config, environment variable)

// Register a database
const dbResponse = await fetch('http://localhost:3000/api/databases', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${jwtToken}` // Use JWT from key
  },
  body: JSON.stringify({
    name: 'My Production DB',
    type: 'postgresql',
    config: {
      host: 'db.example.com',
      port: 5432,
      database: 'myapp',
      user: 'dbuser',
      password: 'dbpass'
    }
  })
});

// Query data
const queryResponse = await fetch(
  'http://localhost:3000/api/databases/:dbId/query/users?limit=10',
  {
    headers: { 'Authorization': `Bearer ${jwtToken}` }
  }
);
const { data } = await queryResponse.json();
```

## Database-Specific Notes

### Supabase
- Requires project URL and anon key
- Supports RPC functions via `executeRaw`

### PostgreSQL
- Supports connection pooling
- Full SQL support via `executeRaw`

### MySQL
- Compatible with MariaDB
- Uses parameterized queries for safety

### MongoDB
- Uses aggregation pipelines for raw queries
- No SQL required

## Production Deployment

### On AWS ECS

```bash
# Build image
docker build -t gateway-api .

# Tag for ECR
docker tag gateway-api:latest <account>.dkr.ecr.<region>.amazonaws.com/gateway-api:latest

# Push to ECR
docker push <account>.dkr.ecr.<region>.amazonaws.com/gateway-api:latest

# Deploy with ECS task definition
```

### On Heroku

```bash
# Login to Heroku
heroku login

# Create app
heroku create my-gateway-api

# Set environment variables
heroku config:set API_KEY_SECRET=your-secret-key

# Deploy
git push heroku main
```

### On Railway

```bash
# Install Railway CLI
npm install -g @railway/cli

# Deploy
railway up
```

## Security Best Practices

1. **Change API_KEY_SECRET** in production
2. **Use HTTPS** for all API calls
3. **Store API keys securely** - never expose in frontend code
4. **Use database credentials** with minimal required permissions
5. **Enable rate limiting** (see middleware examples)
6. **Monitor API usage** for suspicious patterns
7. **Rotate API keys regularly**
8. **Use environment variables** for sensitive data

## Architecture

```
Frontend (SupaMerge)
    ↓
    │ (API Key + JWT)
    ↓
Gateway API (Express.js)
    ├─ API Key Manager (JWT + Hashing)
    ├─ Database Registry
    └─ Adapter Factory
        ├─ Supabase Adapter
        ├─ PostgreSQL Adapter
        ├─ MySQL Adapter
        └─ MongoDB Adapter
    ↓ ↓ ↓ ↓
Multiple Databases
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT

## Support

For issues, questions, or contributions, please open an issue on GitHub.

---

**Made by Parithosh Varma**

Part of the SupaMerge project - Unify Your Supabase Databases
