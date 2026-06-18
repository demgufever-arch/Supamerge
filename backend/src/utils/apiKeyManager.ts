import jwt from 'jsonwebtoken';
import bcryptjs from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

export interface APIKey {
  id: string;
  name: string;
  keyHash: string; // hashed key
  lastUsed?: Date;
  createdAt: Date;
  expiresAt?: Date;
  isActive: boolean;
}

export class APIKeyManager {
  private secret: string;

  constructor(secret: string) {
    this.secret = secret;
  }

  /**
   * Generate a new API key
   */
  generateKey(): string {
    return `sk_${uuidv4().replace(/-/g, '').substring(0, 32)}`;
  }

  /**
   * Hash an API key for storage
   */
  async hashKey(key: string): Promise<string> {
    return bcryptjs.hash(key, 10);
  }

  /**
   * Verify an API key against its hash
   */
  async verifyKey(key: string, hash: string): Promise<boolean> {
    return bcryptjs.compare(key, hash);
  }

  /**
   * Create a JWT token from an API key
   */
  createToken(apiKeyId: string, expiresIn = '24h'): string {
    return jwt.sign(
      {
        apiKeyId,
        type: 'api_key',
      },
      this.secret,
      { expiresIn } as jwt.SignOptions
    );
  }

  /**
   * Verify a JWT token
   */
  verifyToken(token: string): { apiKeyId: string; type: string } | null {
    try {
      const decoded = jwt.verify(token, this.secret) as any;
      return {
        apiKeyId: decoded.apiKeyId,
        type: decoded.type,
      };
    } catch {
      return null;
    }
  }

  /**
   * Extract token from Authorization header
   */
  extractToken(authHeader?: string): string | null {
    if (!authHeader) return null;

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      return null;
    }

    return parts[1];
  }
}
