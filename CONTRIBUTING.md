# Contributing to Insighter

Thank you for your interest in contributing to Insighter! This document provides guidelines and information for contributors.

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Git
- A Supabase account (for development)

### Development Setup

1. **Fork and Clone**
   ```bash
   git clone https://github.com/your-username/insighter.git
   cd insighter
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   ```bash
   cp .env.example .env.local
   # Configure your environment variables
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

## 📋 Development Workflow

### Branch Strategy
- `main` - Production-ready code
- `staging` - Integration branch for testing
- `feature/*` - Feature development branches
- `bugfix/*` - Bug fix branches
- `hotfix/*` - Critical production fixes

### Making Changes

1. **Create a Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make Your Changes**
   - Write clean, readable code
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Your Changes**
   ```bash
   npm run test
   npm run lint
   npm run build
   ```

4. **Commit Your Changes**
   ```bash
   git add .
   git commit -m "feat: add your feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create a pull request on GitHub
   ```

## 📝 Commit Convention

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples
```
feat(database): add support for MySQL connections
fix(ui): resolve modal caching issue
docs: update API documentation
refactor(auth): simplify authentication flow
```

## 🧪 Testing

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Writing Tests
- Write unit tests for utility functions
- Write integration tests for API endpoints
- Write component tests for React components
- Aim for high test coverage

## 🎨 Code Style

### TypeScript
- Use strict TypeScript configuration
- Define proper interfaces and types
- Avoid `any` types
- Use meaningful variable and function names

### React Components
- Use functional components with hooks
- Implement proper error boundaries
- Use TypeScript for all components
- Follow React best practices

### API Routes
- Use proper HTTP status codes
- Implement error handling
- Add input validation
- Document API endpoints

## 📚 Documentation

### Code Documentation
- Add JSDoc comments for functions
- Document complex algorithms
- Explain business logic
- Keep README files updated

### API Documentation
- Document all API endpoints
- Include request/response examples
- Specify error codes and messages
- Update when making changes

## 🐛 Bug Reports

When reporting bugs, please include:

1. **Description**: Clear description of the issue
2. **Steps to Reproduce**: Detailed steps to reproduce the bug
3. **Expected Behavior**: What should happen
4. **Actual Behavior**: What actually happens
5. **Environment**: OS, browser, Node.js version
6. **Screenshots**: If applicable

## 💡 Feature Requests

When requesting features, please include:

1. **Use Case**: Why is this feature needed?
2. **Proposed Solution**: How should it work?
3. **Alternatives**: Other solutions considered
4. **Additional Context**: Any other relevant information

## 🔒 Security

### Reporting Security Issues
- **DO NOT** create public GitHub issues for security vulnerabilities
- Email security issues to: security@klairtech.com
- Include detailed information about the vulnerability
- Allow time for response before public disclosure

### Security Guidelines
- Never commit secrets or API keys
- Use environment variables for sensitive data
- Implement proper input validation
- Follow security best practices

## 🏷️ Release Process

### Versioning
We follow [Semantic Versioning](https://semver.org/):
- `MAJOR`: Breaking changes
- `MINOR`: New features (backward compatible)
- `PATCH`: Bug fixes (backward compatible)

### Release Workflow
1. Create release branch from `main`
2. Update version numbers
3. Update CHANGELOG.md
4. Create pull request
5. Merge and tag release
6. Deploy to production

## 🤝 Community Guidelines

### Code of Conduct
- Be respectful and inclusive
- Welcome newcomers and help them learn
- Focus on constructive feedback
- Respect different opinions and approaches

### Communication
- Use clear and concise language
- Be patient with questions
- Provide helpful feedback
- Stay on topic in discussions

## 📞 Getting Help

- **GitHub Issues**: For bugs and feature requests
- **GitHub Discussions**: For questions and general discussion
- **Email**: contact@klairtech.com for general inquiries

## 🙏 Recognition

Contributors will be recognized in:
- CONTRIBUTORS.md file
- Release notes
- Project documentation

Thank you for contributing to Insighter! 🎉
