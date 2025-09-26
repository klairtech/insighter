import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const JWT_EXPIRES_IN = '365d'; // 1 year expiration

export interface AgentTokenPayload {
  agentId: string;
  workspaceId: string;
  userId: string;
  type: 'agent_api';
  tokenId: string; // Unique identifier for each token generation
  iat?: number;
  exp?: number;
}

/**
 * Generate a JWT token for an agent API
 */
export function generateAgentApiToken(agentId: string, workspaceId: string, userId: string): string {
  // Generate a unique token ID using timestamp + random component
  const tokenId = `${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;
  
  const payload: AgentTokenPayload = {
    agentId,
    workspaceId,
    userId,
    type: 'agent_api',
    tokenId,
  };


  const jwtToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'insighter',
    audience: 'agent_api',
  });

  // Create base64 token combining JWT + user ID for user-specific tokens
  const combinedToken = `${jwtToken}.${userId}`;
  const finalToken = Buffer.from(combinedToken).toString('base64');
  
  return finalToken;
}

/**
 * Verify and decode an agent API token
 */
export function verifyAgentApiToken(token: string): AgentTokenPayload | null {
  try {
    
    // Decode base64 token to get JWT + user ID
    const decodedBase64 = Buffer.from(token, 'base64').toString('utf-8');
    const parts = decodedBase64.split('.');
    
    
    // Handle both old format (JWT.USER_ID) and new format (JWT_HEADER.JWT_PAYLOAD.JWT_SIGNATURE.USER_ID)
    let jwtToken: string;
    let userId: string;
    
    if (parts.length === 2) {
      // Old format: JWT.USER_ID
      [jwtToken, userId] = parts;
    } else if (parts.length === 4) {
      // New format: JWT_HEADER.JWT_PAYLOAD.JWT_SIGNATURE.USER_ID
      jwtToken = parts.slice(0, 3).join('.');
      userId = parts[3];
    } else {
      console.error('❌ Invalid token format - expected 2 or 4 parts, got:', parts.length);
      return null;
    }
    
    
    if (!jwtToken || !userId) {
      console.error('❌ Missing JWT token or user ID');
      return null;
    }

    const decoded = jwt.verify(jwtToken, JWT_SECRET, {
      issuer: 'insighter',
      audience: 'agent_api',
    }) as AgentTokenPayload;


    if (decoded.type !== 'agent_api' || decoded.userId !== userId) {
      console.error('❌ Token validation failed:', { 
        typeMatch: decoded.type === 'agent_api', 
        userIdMatch: decoded.userId === userId 
      });
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('❌ JWT verification failed:', error);
    return null;
  }
}

/**
 * Extract token from Authorization header
 */
export function extractTokenFromHeader(authHeader: string | null): string | null {
  if (!authHeader) return null;
  
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }
  
  return parts[1];
}
