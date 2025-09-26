# Insighter - Next.js Application

This is the Next.js version of the Insighter AI-powered data analytics platform. It has been converted from the original Flask + React architecture to a modern Next.js full-stack application.

## 🚀 Features

- **Full-Stack Next.js Application**: Server-side rendering, API routes, and client-side interactivity
- **AI-Powered Data Analysis**: Natural language queries with AI insights
- **Multi-Organization Support**: Create and manage multiple organizations and workspaces
- **Database Connectivity**: Connect to various database types (MySQL, PostgreSQL, SQLite, etc.)
- **File Upload & Processing**: Upload and analyze CSV, Excel, and other file formats
- **Real-time Chat Interface**: Interactive AI agent conversations
- **Responsive Design**: Modern UI with Tailwind CSS
- **Authentication & Security**: JWT-based authentication with secure API routes
- **Hierarchical Access Control**: Organization → Workspace → Agent access inheritance
- **TypeScript Support**: Full type safety throughout the application

## 🏗️ Architecture

```
insighter-nextjs/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes
│   │   ├── login/             # Login page
│   │   ├── organizations/     # Organizations pages
│   │   └── layout.tsx         # Root layout
│   ├── components/            # React components
│   │   ├── pages/            # Page components
│   │   └── ui/               # UI components
│   ├── contexts/             # React contexts
│   ├── lib/                  # Utility libraries
│   ├── services/             # API services
│   └── types/                # TypeScript types
├── public/                   # Static assets
└── package.json             # Dependencies
```

## 🛠️ Technology Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (with PostgreSQL support)
- **Authentication**: JWT tokens
- **AI Integration**: OpenAI, Anthropic, Google AI
- **Charts**: Chart.js, Recharts
- **UI Components**: Custom components with Tailwind

## 📦 Installation

1. **Clone and navigate to the project**:

   ```bash
   cd insighter-nextjs
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env.local` file in the root directory:

   ```env
   # Next.js Configuration
   NEXT_PUBLIC_API_URL=http://localhost:3000/api

   # JWT Secret (change this in production)
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

   # Database Configuration
   DATABASE_URL=./app_state.db

   # AI Service Keys (optional)
   OPENAI_API_KEY=your-openai-api-key
   ANTHROPIC_API_KEY=your-anthropic-api-key
   GOOGLE_AI_API_KEY=your-google-ai-api-key
   ```

4. **Run the development server**:

   ```bash
   npm run dev
   ```

5. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## 🗄️ Database Setup

The application uses SQLite by default and will automatically create the necessary tables on first run. The database file will be created at `./app_state.db`.

### Database Tables

- `users` - User accounts and profiles
- `organizations` - Organization information
- `organization_members` - User-organization relationships
- `workspaces` - Workspaces within organizations
- `database_connections` - Database connection configurations
- `external_connections` - External API connections
- `file_uploads` - Uploaded file metadata
- `agent_conversations` - AI agent chat history
- `admin_users` - Admin user accounts

## 🔐 Authentication

The application uses JWT-based authentication:

- **User Registration**: `/api/auth/register`
- **User Login**: `/api/auth/login`
- **Admin Login**: `/api/admin/login`
- **Protected Routes**: All API routes require valid JWT tokens

## 📡 API Routes

### Authentication

- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `POST /api/auth/logout` - User logout

### User Management

- `GET /api/user/profile` - Get user profile
- `PUT /api/user/profile` - Update user profile

### Organizations

- `GET /api/organizations` - List user's organizations
- `POST /api/organizations` - Create new organization
- `GET /api/organizations/[id]` - Get organization details
- `PUT /api/organizations/[id]` - Update organization
- `DELETE /api/organizations/[id]` - Delete organization

### Workspaces

- `GET /api/workspaces/[id]` - Get workspace details
- `POST /api/workspaces` - Create new workspace
- `PUT /api/workspaces/[id]` - Update workspace
- `DELETE /api/workspaces/[id]` - Delete workspace

### Data Connections

- `GET /api/workspaces/[id]/database-connections` - List database connections
- `POST /api/workspaces/[id]/database-connections` - Create database connection
- `POST /api/workspaces/[id]/database-connections/test` - Test database connection
- `DELETE /api/workspaces/[id]/database-connections/[connectionId]` - Delete connection

### AI Agent

- `POST /api/workspaces/[id]/ask-agent` - Send message to AI agent
- `GET /api/workspaces/[id]/agent-history` - Get conversation history

## 🎨 UI Components

### Pages

- **Home** (`/`) - Landing page with features and FAQ
- **Login** (`/login`) - User authentication
- **Organizations** (`/organizations`) - Organization management
- **Organization Detail** (`/organizations/[id]`) - Organization details and workspaces
- **Workspace Detail** (`/workspaces/[id]`) - Workspace management
- **Ask Agent** (`/ask-agent`) - AI chat interface
- **Canvas** (`/canvas`) - Data visualization canvas

### Components

- **Navigation** - Main navigation bar
- **Footer** - Site footer
- **AuthContext** - Authentication state management
- **API Service** - Centralized API calls

## 🔐 Hierarchical Access Control

The application implements a comprehensive hierarchical access control system:

```
Organization (Owner/Admin/Member) → Workspace (Admin/Member/Viewer) → Agent (Read/Write)
```

### Key Features

- **Automatic Access Inheritance**: Users automatically get workspace and agent access based on organization membership
- **Database-Level Enforcement**: Row Level Security (RLS) policies enforce access at the database level
- **Performance Optimized**: Indexes ensure fast access control checks
- **Audit Logging**: All access changes are logged for security monitoring

### Documentation

- **Complete Guide**: [`docs/HIERARCHICAL_ACCESS_CONTROL.md`](HIERARCHICAL_ACCESS_CONTROL.md)
- **Implementation**: [`scripts/hierarchical-access-control.sql`](../scripts/hierarchical-access-control.sql)
- **Migration Guide**: [`scripts/README-HIERARCHICAL-ACCESS.md`](../scripts/README-HIERARCHICAL-ACCESS.md)

## 🔧 Development

### Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint

### Project Structure

The application follows Next.js 14 App Router conventions:

- **App Router**: Uses the new `app/` directory structure
- **API Routes**: Server-side API endpoints in `app/api/`
- **Server Components**: Default server-side rendering
- **Client Components**: Marked with `'use client'` directive
- **TypeScript**: Full type safety with strict configuration

## 🚀 Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Set environment variables in Vercel dashboard
4. Deploy automatically

### Other Platforms

The application can be deployed to any platform that supports Node.js:

- **Docker**: Use the included Dockerfile
- **Railway**: Connect GitHub repository
- **Heroku**: Use the included buildpacks
- **AWS/GCP/Azure**: Use container services

## 🔒 Security Features

- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcrypt with salt rounds
- **CORS Protection**: Configurable CORS origins
- **Input Validation**: Server-side validation for all inputs
- **SQL Injection Protection**: Parameterized queries
- **XSS Protection**: React's built-in XSS protection

## 📊 AI Integration

The application supports multiple AI providers:

- **OpenAI**: GPT models for natural language processing
- **Anthropic**: Claude models for advanced reasoning
- **Google AI**: Gemini models for multimodal analysis

Configure your API keys in the environment variables to enable AI features.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is proprietary software. All rights reserved.

## 🆘 Support

For support and questions:

1. Check the documentation in the `docs/` directory
2. Review the API documentation
3. Contact the development team

---

**Built with ❤️ using Next.js, TypeScript, and Tailwind CSS**
