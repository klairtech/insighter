export const config = {
  // API Configuration
  API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api',
  
  // JWT Configuration
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production',
  JWT_EXPIRES_IN: '7d',
  
  // Database Configuration
  DATABASE_URL: process.env.DATABASE_URL || './app_state.db',
  
  // AI Service Configuration
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
  GOOGLE_AI_API_KEY: process.env.GOOGLE_AI_API_KEY,
  
  // File Upload Configuration
  MAX_FILE_SIZE: parseInt(process.env.MAX_FILE_SIZE || '10485760'), // 10MB
  UPLOAD_DIR: process.env.UPLOAD_DIR || './uploads',
  
  // Security Configuration
  CORS_ORIGINS: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  SESSION_SECRET: process.env.SESSION_SECRET || 'your-session-secret-key',
  
  // Environment
  NODE_ENV: process.env.NODE_ENV || 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  
  // Email Configuration (optional)
  SMTP: {
    HOST: process.env.SMTP_HOST,
    PORT: parseInt(process.env.SMTP_PORT || '587'),
    USER: process.env.SMTP_USER,
    PASS: process.env.SMTP_PASS,
  }
}

export default config
