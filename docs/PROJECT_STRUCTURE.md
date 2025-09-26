# 📁 Insighter Next.js Project Structure

## 🏗️ Current Project Organization

```
insighter-nextjs/
├── 📁 docs/                          # All documentation
│   ├── AI_ML_CAPABILITIES_ANALYSIS.md
│   ├── DOCKER_ASSESSMENT.md
│   ├── ENVIRONMENT_SETUP.md
│   ├── KLAIR_REDESIGN_COMPLETE.md
│   ├── MIGRATION_COMPLETE.md
│   ├── MIGRATION_SUMMARY.md
│   ├── PROJECT_STRUCTURE.md
│   ├── README.md
│   └── SSR_PERFORMANCE_OPTIMIZATION.md
├── 📁 scripts/                       # Database and utility scripts
│   └── supabase-schema.sql
├── 📁 src/                          # Source code
│   ├── 📁 app/                      # Next.js App Router
│   │   ├── 📁 api/                  # API routes
│   │   │   ├── 📁 auth/
│   │   │   ├── 📁 admin/
│   │   │   ├── 📁 organizations/
│   │   │   ├── 📁 user/
│   │   │   └── 📁 workspaces/
│   │   ├── 📁 login/
│   │   ├── 📁 register/
│   │   ├── 📁 organizations/
│   │   ├── 📁 ask-agent/
│   │   ├── 📁 canvas/
│   │   ├── 📁 profile/
│   │   ├── 📁 admin/
│   │   ├── 📁 about-us/
│   │   ├── 📁 contact-us/
│   │   ├── 📁 pricing/
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── 📁 components/               # React components
│   │   ├── 📁 server/              # Server components
│   │   ├── 📁 providers/           # Context providers
│   │   ├── Navigation.tsx
│   │   ├── Footer.tsx
│   │   ├── LogoRobust.tsx
│   │   ├── LoginModal.tsx
│   │   ├── AgentSharing.tsx
│   │   ├── OrganizationSharing.tsx
│   │   └── WorkspaceSharing.tsx
│   ├── 📁 contexts/                # React contexts
│   │   └── AuthContext.tsx
│   ├── 📁 lib/                     # Utility libraries
│   │   ├── ai-agents.ts
│   │   ├── ai-summary.ts
│   │   ├── api-conversations.ts
│   │   ├── api-encryption.ts
│   │   ├── config.ts
│   │   ├── database.ts
│   │   ├── email.ts
│   │   ├── encryption.ts
│   │   ├── guardrails.ts
│   │   ├── jwt-utils.ts
│   │   ├── performance.ts
│   │   ├── permissions.ts
│   │   ├── server-utils.ts
│   │   └── supabase-auth.ts
│   └── 📁 services/                # API services
│       └── api.ts
├── 📁 public/                      # Static assets
│   ├── logo.svg
│   ├── logo-blue.svg
│   └── logo-white.svg
├── 📄 .env                         # Environment variables (template)
├── 📄 .gitignore                   # Git ignore rules
├── 📄 docker-compose.yml           # Docker configuration
├── 📄 Dockerfile                   # Docker image definition
├── 📄 deploy.sh                    # Deployment script
├── 📄 eslint.config.mjs            # ESLint configuration
├── 📄 next.config.js               # Next.js configuration
├── 📄 next-env.d.ts                # Next.js TypeScript definitions
├── 📄 package.json                 # Dependencies and scripts
├── 📄 package-lock.json            # Dependency lock file
├── 📄 postcss.config.mjs           # PostCSS configuration
├── 📄 start.sh                     # Startup script (NEW)
├── 📄 tsconfig.json                # TypeScript configuration
└── 📄 README.md                    # Project overview
```

## 🎯 Key Improvements Made

### **1. Documentation Organization**

- ✅ **Centralized**: All docs moved to `docs/` folder
- ✅ **Comprehensive**: Complete migration and setup guides
- ✅ **Technical**: AI/ML capabilities and Docker assessment
- ✅ **Performance**: SSR and optimization documentation

### **2. Scripts Organization**

- ✅ **Database**: Supabase schema moved to `scripts/`
- ✅ **Analysis**: Bundle analysis script
- ✅ **Utilities**: Database initialization (deprecated)

### **3. Startup Script**

- ✅ **Automated**: `start.sh` handles complete setup
- ✅ **Flexible**: Multiple modes (dev, prod, preview)
- ✅ **Comprehensive**: Environment setup, dependencies, building

## 🚀 Quick Start Guide

### **1. Initial Setup**

```bash
# Make startup script executable
chmod +x start.sh

# Run full setup
./start.sh --setup

# Or just start development
./start.sh
```

### **2. Development Workflow**

```bash
# Start development server
./start.sh development

# Build for production
./start.sh --build production

# Analyze bundle size
./start.sh --analyze

# Clean build artifacts
./start.sh --clean
```

### **3. Environment Configuration**

```bash
# The startup script creates .env.local with:
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url_here
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key_here
# ... and more
```

## 🔧 Configuration Files

### **Next.js Configuration (`next.config.js`)**

- ✅ **SSR Optimized**: Server-side rendering configuration
- ✅ **Bundle Splitting**: Optimized chunk splitting
- ✅ **Image Optimization**: Next.js image optimization
- ✅ **Performance**: Caching and compression
- ✅ **Security**: Security headers and CORS

### **TypeScript Configuration (`tsconfig.json`)**

- ✅ **Strict Mode**: Strict TypeScript checking
- ✅ **Path Mapping**: Clean import paths
- ✅ **Next.js Integration**: Optimized for Next.js

### **Package.json Scripts**

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "lint:fix": "next lint --fix",
    "type-check": "tsc --noEmit",
    "analyze": "node scripts/analyze-bundle.js",
    "analyze:bundle": "ANALYZE=true npm run build",
    "build:analyze": "cross-env ANALYZE=true next build",
    "perf": "npm run build && npm run start",
    "clean": "rm -rf .next out dist",
    "preview": "npm run build && npm run start"
  }
}
```

## 🗄️ Database Integration

### **Supabase Integration**

- ✅ **Existing Setup**: Uses your existing Supabase instance
- ✅ **Auth Integration**: Leverages Supabase Auth
- ✅ **Database**: Uses your existing database schema
- ✅ **Real-time**: Supabase real-time subscriptions

### **Schema Location**

- 📁 **Location**: `scripts/supabase-schema.sql`
- 📋 **Purpose**: Insighter-specific tables and functions
- 🔗 **Integration**: Works with your existing Supabase setup

## 🎨 Design System

### **Klair Branding**

- ✅ **Global Styles**: `src/app/globals.css`
- ✅ **Component Classes**: `.klair-*` utility classes
- ✅ **Color Palette**: Black canvas with blue gradients
- ✅ **Typography**: Google Sans + Poppins fonts

### **Component Architecture**

- ✅ **Server Components**: For SSR optimization
- ✅ **Client Components**: For interactivity
- ✅ **Lazy Loading**: Dynamic imports for performance
- ✅ **Performance Monitoring**: Built-in performance tracking

## 📊 Performance Features

### **SSR Optimization**

- ✅ **Server Components**: Reduced client-side JavaScript
- ✅ **Metadata Generation**: Dynamic SEO optimization
- ✅ **Caching**: Server-side caching strategies
- ✅ **Rate Limiting**: API protection

### **Client-Side Optimization**

- ✅ **Code Splitting**: Dynamic imports
- ✅ **Bundle Analysis**: Webpack bundle analyzer
- ✅ **Lazy Loading**: Component and image lazy loading
- ✅ **Performance Monitoring**: Real-time metrics

## 🔐 Security Features

### **Authentication**

- ✅ **Supabase Auth**: Integration with your existing auth
- ✅ **JWT Tokens**: Secure token handling
- ✅ **Session Management**: Persistent sessions
- ✅ **Role-based Access**: Admin and user roles

### **API Security**

- ✅ **Rate Limiting**: Request rate limiting
- ✅ **CORS**: Cross-origin resource sharing
- ✅ **Security Headers**: XSS and CSRF protection
- ✅ **Input Validation**: Server-side validation

## 🚀 Deployment Options

### **Vercel (Recommended)**

```bash
# Deploy to Vercel
vercel --prod
```

### **Docker (For ML Services)**

```bash
# Build and run with Docker
docker-compose -f docker-compose.dev.yml up -d
```

### **Manual Deployment**

```bash
# Build and start
./start.sh --build production
```

## 📈 Monitoring & Analytics

### **Performance Monitoring**

- ✅ **Core Web Vitals**: LCP, FID, CLS tracking
- ✅ **Bundle Analysis**: Size optimization
- ✅ **Memory Usage**: JavaScript heap monitoring
- ✅ **API Performance**: Response time tracking

### **Error Tracking**

- ✅ **Console Logging**: Development error tracking
- ✅ **API Error Handling**: Graceful error responses
- ✅ **Performance Alerts**: Slow operation detection

## 🎉 Summary

The project is now well-organized with:

- ✅ **Centralized Documentation**: All docs in `docs/` folder
- ✅ **Automated Startup**: `start.sh` script for easy setup
- ✅ **Database Integration**: Works with your existing Supabase
- ✅ **Performance Optimized**: SSR and client-side optimizations
- ✅ **Klair Branding**: Complete design system implementation
- ✅ **Production Ready**: Optimized for deployment

The project structure is clean, scalable, and ready for development and production use! 🚀
