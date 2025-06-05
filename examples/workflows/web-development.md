# Web Development Workflow Examples

Complete workflows for web development projects using the CLI utility.

## React Project Setup

### Create New React Project

```bash
# Create a complete React project with TypeScript and testing
roo "create a React project with TypeScript, Tailwind CSS, and Jest testing setup"
```

**Description:** Sets up a complete React development environment with modern tooling.

**Expected Output:**

- Project structure with src/, public/, tests/ directories
- package.json with all dependencies
- TypeScript configuration
- Tailwind CSS setup
- Jest testing configuration

**Prerequisites:**

- Node.js installed
- npm or yarn available

**Difficulty:** Intermediate  
**Estimated Time:** 3-5 minutes  
**Tags:** #react #typescript #tailwind #setup

---

### Component Development

```bash
# Generate a component with props validation and tests
roo "create a UserProfile component with TypeScript interfaces, props validation, and unit tests"

# Add state management
roo "add Redux Toolkit state management for user data with TypeScript"

# Create API integration
roo "add API service for user management with error handling and TypeScript types"
```

**Description:** Complete component development workflow including state management and API integration.

**Difficulty:** Intermediate  
**Estimated Time:** 5-8 minutes  
**Tags:** #react #components #redux #api #typescript

---

## Vue.js Project Workflow

### Vue 3 Project Setup

```bash
# Create Vue 3 project with Composition API
roo "create a Vue 3 project using Composition API, TypeScript, and Pinia for state management"

# Add component library
roo "integrate Vuetify component library with custom theme configuration"
```

**Description:** Modern Vue.js project setup with latest features.

**Difficulty:** Intermediate  
**Estimated Time:** 4-6 minutes  
**Tags:** #vue #composition-api #pinia #vuetify

---

## Full-Stack Development

### Node.js Backend Setup

```bash
# Create Express.js API server
roo "create an Express.js server with TypeScript, authentication middleware, and MongoDB integration"

# Add API endpoints
roo "create REST API endpoints for user management with validation and error handling"

# Add testing
roo "add Jest tests for all API endpoints with mock database"
```

**Description:** Complete backend development workflow.

**Difficulty:** Advanced  
**Estimated Time:** 8-12 minutes  
**Tags:** #nodejs #express #mongodb #api #testing

---

### Database Integration

```bash
# Add Prisma ORM
roo "integrate Prisma ORM with PostgreSQL database and generate type-safe client"

# Create database schema
roo "design database schema for e-commerce application with products, users, and orders"

# Add migrations
roo "create database migrations and seed data for development"
```

**Description:** Database integration and schema management.

**Difficulty:** Advanced  
**Estimated Time:** 6-10 minutes  
**Tags:** #prisma #postgresql #schema #migrations

---

## Static Site Generation

### Next.js Static Site

```bash
# Create Next.js static site
roo "create a Next.js static site with blog functionality and MDX support"

# Add SEO optimization
roo "add SEO optimization with meta tags, sitemap, and OpenGraph support"

# Configure deployment
roo "configure deployment to Vercel with automatic builds and preview deployments"
```

**Description:** Static site generation workflow with modern tooling.

**Difficulty:** Intermediate  
**Estimated Time:** 5-8 minutes  
**Tags:** #nextjs #static #seo #vercel #mdx

---

## Development Tools Integration

### Code Quality Setup

```bash
# Add linting and formatting
roo "configure ESLint, Prettier, and Husky for code quality enforcement"

# Add type checking
roo "setup TypeScript strict mode with comprehensive type checking"

# Configure pre-commit hooks
roo "setup pre-commit hooks for linting, testing, and type checking"
```

**Description:** Code quality tools and automation setup.

**Difficulty:** Intermediate  
**Estimated Time:** 3-5 minutes  
**Tags:** #eslint #prettier #husky #typescript #quality

---

### Testing Strategy

```bash
# Unit testing setup
roo "setup comprehensive Jest testing with React Testing Library"

# E2E testing
roo "add Playwright end-to-end testing with CI/CD integration"

# Visual regression testing
roo "setup Chromatic for visual regression testing of components"
```

**Description:** Complete testing strategy implementation.

**Difficulty:** Advanced  
**Estimated Time:** 6-10 minutes  
**Tags:** #jest #playwright #chromatic #testing #e2e

---

## Performance Optimization

### Bundle Optimization

```bash
# Analyze bundle size
roo "analyze webpack bundle size and identify optimization opportunities"

# Add code splitting
roo "implement code splitting and lazy loading for improved performance"

# Optimize images
roo "setup image optimization with WebP conversion and lazy loading"
```

**Description:** Performance optimization techniques.

**Difficulty:** Advanced  
**Estimated Time:** 4-7 minutes  
**Tags:** #performance #webpack #optimization #images

---

## Deployment Workflows

### Docker Containerization

```bash
# Create Docker setup
roo "create multi-stage Dockerfile for production deployment with nginx"

# Add docker-compose
roo "create docker-compose configuration for development and production environments"

# Setup CI/CD
roo "configure GitHub Actions for automated testing, building, and deployment"
```

**Description:** Containerization and deployment automation.

**Difficulty:** Advanced  
**Estimated Time:** 8-12 minutes  
**Tags:** #docker #nginx #github-actions #cicd #deployment

---

## Complete Project Example

### E-commerce Application

```bash
# 1. Initialize project
roo "create a full-stack e-commerce application with React frontend and Node.js backend"

# 2. Setup database
roo "design and implement database schema for products, users, orders, and payments"

# 3. Implement authentication
roo "add JWT authentication with refresh tokens and role-based access control"

# 4. Create product catalog
roo "implement product catalog with search, filtering, and pagination"

# 5. Add shopping cart
roo "create shopping cart functionality with local storage persistence"

# 6. Implement checkout
roo "add checkout process with Stripe payment integration"

# 7. Add admin panel
roo "create admin panel for product and order management"

# 8. Setup deployment
roo "configure production deployment with Docker and AWS"
```

**Description:** Complete e-commerce application development workflow.

**Prerequisites:**

- Node.js and npm installed
- Database server (PostgreSQL)
- Stripe account for payments
- AWS account for deployment

**Difficulty:** Advanced  
**Estimated Time:** 2-4 hours  
**Tags:** #ecommerce #fullstack #stripe #aws #production

**Note:** This is a comprehensive example that combines multiple workflows. Each step can be executed separately.
