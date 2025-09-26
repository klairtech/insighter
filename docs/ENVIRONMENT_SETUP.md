# Environment Setup Guide

## Required Environment Variables

Create a `.env.local` file in the root directory with the following variables:

### Supabase Configuration

```bash
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### JWT Configuration

```bash
JWT_SECRET=your_jwt_secret_key_here
```

### API Configuration

```bash
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000
```

### AI/LLM Configuration (Optional)

```bash
OPENAI_API_KEY=your_openai_api_key
ANTHROPIC_API_KEY=your_anthropic_api_key
GOOGLE_AI_API_KEY=your_google_ai_api_key
```

### Email Configuration (Optional)

```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_email_password
```

### File Upload Configuration

```bash
MAX_FILE_SIZE=10485760
UPLOAD_DIR=./uploads
```

### Security Configuration

```bash
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

### Development Configuration

```bash
NODE_ENV=development
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Setup Instructions

1. **Create Supabase Project**

   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Copy the project URL and anon key
   - Run the SQL schema from `supabase-schema.sql` in the SQL editor

2. **Generate JWT Secret**

   ```bash
   openssl rand -base64 32
   ```

3. **Configure AI Services (Optional)**

   - Get API keys from OpenAI, Anthropic, or Google AI
   - Add them to your environment variables

4. **Start the Application**
   ```bash
   npm run dev
   ```

## Default Admin Credentials

- **Email**: admin@insighter.ai
- **Password**: admin123

**Important**: Change these credentials after first login!
