# Insighter

**AI-powered database insights platform for modern data teams**

Insighter is a comprehensive platform that transforms how teams interact with their databases through AI-powered insights, intelligent agents, and collaborative workspaces.

## 🚀 Features

### 🗄️ Database Management
- **Multi-database Support**: Connect to PostgreSQL, MySQL, and BigQuery
- **AI-Powered Insights**: Automatic generation of smart descriptions for tables, columns, and databases
- **Schema Analysis**: Comprehensive database schema exploration and documentation
- **Real-time Connection Testing**: Validate database connections before setup

### 🤖 AI Agents
- **Intelligent Chat**: Natural language queries about your database
- **Context-Aware Responses**: Agents understand your specific database structure
- **Customizable Avatars**: Personalize your AI agents with custom avatars
- **Token Management**: Track and manage AI usage across your organization

### 👥 Collaboration
- **Workspace Management**: Organize databases and files in dedicated workspaces
- **Team Sharing**: Invite team members with role-based access control
- **Organization Structure**: Hierarchical organization management
- **Real-time Collaboration**: Share insights and findings with your team

### 📊 Data Insights
- **Smart Descriptions**: AI-generated explanations of your data structure
- **Sample Data Analysis**: Understand your data through intelligent sampling
- **Relationship Mapping**: Visualize foreign key relationships and dependencies
- **Performance Monitoring**: Track database performance and usage patterns

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Supabase
- **Database**: PostgreSQL (Supabase), MySQL, BigQuery
- **AI**: OpenAI GPT-4, xAI Grok
- **Authentication**: Supabase Auth with Google SSO
- **Deployment**: Vercel-ready with environment configuration

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account
- OpenAI API key

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd insighter
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   ```
   
   Configure your environment variables:
   ```env
   # Supabase
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   
   # OpenAI
   OPENAI_API_KEY=your_openai_api_key
   
   # xAI (optional)
   XAI_API_KEY=your_xai_api_key
   ```

4. **Database Setup**
   ```bash
   # Run the Supabase schema
   psql -h your_supabase_host -U postgres -d postgres -f scripts/supabase-schema.sql
   ```

5. **Start Development Server**
   ```bash
   npm run dev
   ```

6. **Open in Browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
src/
├── app/                    # Next.js app router
│   ├── api/               # API routes
│   ├── workspaces/        # Workspace management
│   ├── organizations/     # Organization features
│   └── admin/            # Admin dashboard
├── components/            # Reusable UI components
├── lib/                  # Utility libraries
├── types/                # TypeScript type definitions
└── contexts/             # React contexts
```

## 🔧 API Endpoints

### Database Connections
- `POST /api/database-connections` - Create new database connection
- `GET /api/database-connections/[id]` - Get connection details
- `POST /api/database-connections/test` - Test database connection
- `POST /api/database-connections/validate-schema` - Validate schema access

### AI Features
- `POST /api/database-connections/[id]/generate-hierarchical-ai` - Generate AI definitions
- `GET /api/chat/agents/[agentId]` - Chat with AI agents
- `POST /api/agents/[id]/chat` - Send message to agent

### Workspace Management
- `GET /api/workspaces` - List user workspaces
- `POST /api/workspaces` - Create new workspace
- `GET /api/workspaces/[id]/database-connections` - Get workspace databases

## 🎯 Key Features in Detail

### Database Connection Flow
1. **Connection Test**: Validate database credentials
2. **Schema Validation**: Check schema access permissions
3. **Table Discovery**: Fetch available tables and views
4. **Column Analysis**: Extract column details and sample data
5. **AI Generation**: Create smart descriptions for all database elements
6. **Workspace Integration**: Add to workspace for team collaboration

### AI-Powered Insights
- **Column Descriptions**: Understand what each column represents
- **Table Summaries**: Get overview of table purpose and relationships
- **Database Overview**: High-level understanding of your entire database
- **Smart Queries**: Natural language database exploration

### Security & Privacy
- **Encrypted Storage**: All sensitive data encrypted at rest
- **Role-Based Access**: Granular permissions for team members
- **Audit Logging**: Track all database access and modifications
- **Secure Connections**: SSL/TLS for all database connections

## 🚀 Deployment

### Vercel Deployment
1. Connect your GitHub repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

### Environment Variables
```env
# Production
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
XAI_API_KEY=
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the `/docs` folder for detailed guides
- **Issues**: Report bugs and request features via GitHub Issues
- **Discussions**: Join community discussions for help and ideas

## 🗺️ Roadmap

- [ ] Advanced query builder
- [ ] Data visualization dashboard
- [ ] Automated report generation
- [ ] Multi-tenant architecture
- [ ] Advanced AI model integration
- [ ] Real-time collaboration features

---

**Built with ❤️ for modern data teams**
