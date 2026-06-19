# Alba Social Backend


A NestJS backend application for a golf social networking platform that connects golfers, facilitates game organization, and handles payments through Stripe.

## Table of Contents

- [Project Overview](#project-overview)
- [Tech Stack](#tech-stack)
- [Architecture](#architecture)
- [Prerequisites](#prerequisites)
- [Getting Started](#getting-started)
- [Environment Variables](#environment-variables)
- [Database Setup](#database-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Key Modules](#key-modules)
- [Development Guidelines](#development-guidelines)
- [Deployment](#deployment)
- [Troubleshooting](#troubleshooting)

## Project Overview

Alba is a golf social networking platform that enables golfers to:

- **Onboard users** with a series of questions to build comprehensive golf profiles (handicap range, player type, game preferences, availability)
- **Post games** (rounds of golf) with specific requirements (number of players, game type, location, time slot)
- **Recommend games** to users based on their preferences and location
- **Join games** and manage player approvals
- **Handle payments** via Stripe with manual payouts, holding funds for 2 days after games for dispute resolution
- **Manage social features** including posts, groups, conversations, leaderboards, and notifications
- **Moderate content** through reports and blocking functionality

### Core Workflow

1. User completes onboarding with golf preferences
2. Users post games with requirements (players needed, time slot, location, etc.)
3. System recommends games to users based on preferences
4. Users request to join games or receive invitations
5. Organizer approves players
6. Once enough players are approved, organizer books the round off-app
7. Organizer updates game with exact time
8. Organizer requests payment split
9. Players pay via Stripe
10. Funds are held for 2 days after the game for dispute resolution
11. Payouts are processed to organizers

## Tech Stack

- **Framework**: NestJS 10.x
- **Language**: TypeScript 5.x
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Firebase Auth (JWT)
- **Payment Processing**: Stripe (Connect for payouts)
- **File Storage**: AWS S3
- **Real-time Communication**: Socket.IO
- **Push Notifications**: Expo Server SDK
- **Maps & Location**: Google Maps API, Mapbox
- **API Documentation**: Swagger/OpenAPI
- **Testing**: Jest
- **Code Quality**: ESLint, Prettier

## Architecture

The application follows NestJS modular architecture principles:

```
src/
├── app.module.ts          # Root module
├── main.ts                # Application entry point
├── auth/                  # Authentication & authorization
├── users/                 # User management
├── profiles/              # User profiles
├── games/                 # Game creation, management, suggestions
├── courses/               # Golf course data
├── groups/                # Social groups
├── posts/                 # Social posts (general & score posts)
├── conversations/         # Conversation management
├── messages/              # Message handling
├── websockets/            # Real-time chat via Socket.IO
├── stripe/                # Payment processing & webhooks
├── notifications/         # Push notifications
├── images/                # Image upload & management
├── image-processing/      # Image processing utilities
├── locations/             # Location services
├── leaderboards/          # Leaderboard calculations
├── relationships/         # Follow/following relationships
├── complaints/          # Game complaint system
├── reports/               # Content reporting
├── blocks/                # User blocking
├── prisma/                # Database service
└── shared/                # Shared utilities & services
```

### Key Design Patterns

- **Modular Architecture**: One module per domain/feature
- **Dependency Injection**: NestJS DI container
- **DTOs with Validation**: Class-validator for input validation
- **Service Layer**: Business logic separated from controllers
- **Repository Pattern**: Prisma service for data access
- **Strategy Pattern**: Used in game suggestion algorithms

## Prerequisites

- **Node.js**: v18.x or higher
- **npm**: v9.x or higher
- **PostgreSQL**: v14.x or higher
- **Firebase Account**: For authentication
- **Stripe Account**: For payment processing
- **AWS Account**: For S3 storage (optional, for image uploads)
- **Google Maps API Key**: For location services
- **Mapbox API Key**: For geocoding (optional)

## Getting Started

### 1. Clone the Repository

```bash
git clone <repository-url>
cd alba-social-backend
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Environment Variables

Copy the example environment file and configure it (see [Environment Variables](#environment-variables) section):

```bash
cp temp.env .env
```

### 4. Set Up Database

See [Database Setup](#database-setup) section for detailed instructions.

### 5. Generate Prisma Client

```bash
npx prisma generate
```

### 6. Run Database Migrations

```bash
npx prisma migrate deploy
```

### 7. Start the Application

```bash
# Development mode with hot reload
npm run start:dev

# Production mode
npm run start:prod
```

The application will be available at `http://localhost:3000`

## Environment Variables

Create a `.env` file in the root directory with the following variables:

### Database

```env
DATABASE_URL="postgresql://user:password@localhost:5432/alba_db?schema=public"
```

### Firebase Authentication

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk@your-project.iam.gserviceaccount.com
```

### Stripe

```env
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
WEBHOOK_BASE_URL=https://your-domain.com
```

### AWS S3 (for image uploads)

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
S3_BUCKET_NAME=your-bucket-name
```

### Google Maps

```env
GOOGLE_MAPS_API_KEY=your-api-key
```

### Mapbox (optional)

```env
MAPBOX_ACCESS_TOKEN=your-access-token
```

### Expo Push Notifications

```env
EXPO_ACCESS_TOKEN=your-expo-access-token
```

### Application

```env
PORT=3000
NODE_ENV=development
```

## Database Setup

### 1. Create PostgreSQL Database

```bash
createdb alba_db
```

Or using psql:

```sql
CREATE DATABASE alba_db;
```

### 2. Run Migrations

```bash
# Apply all pending migrations
npx prisma migrate deploy

# Or in development, create a new migration
npx prisma migrate dev --name your_migration_name
```

### 3. Seed Database (if applicable)

```bash
# If you have seed scripts
npx prisma db seed
```

### 4. View Database Schema

```bash
# Open Prisma Studio to view and edit data
npx prisma studio
```

### 5. Import Golf Courses (Optional)

```bash
npm run import-courses
```

## Running the Application

### Development Mode

```bash
npm run start:dev
```

Runs the app in watch mode with hot reload. The app will automatically restart on file changes.

### Production Mode

```bash
npm run build
npm run start:prod
```

### Debug Mode

```bash
npm run start:debug
```

### Docker (if configured)

```bash
./docker-run.sh
```

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:cov
```

### End-to-End Tests

```bash
npm run test:e2e
```

### Test Structure

- Unit tests: `*.spec.ts` files alongside source files
- E2E tests: Located in `/test` directory
- Test files follow the pattern: `*.spec.ts` or `*.e2e-spec.ts`

## API Documentation

Once the application is running, Swagger API documentation is available at:

```
http://localhost:3000/api
```

The Swagger UI provides:

- Interactive API exploration
- Request/response schemas
- Authentication testing
- Example requests

### Key Endpoints

- **Authentication**: `/auth/*`
- **Users**: `/users/*`
- **Games**: `/games/*`
- **Courses**: `/courses/*`
- **Posts**: `/posts/*`
- **Conversations**: `/conversations/*`
- **Stripe Webhooks**: `/stripe/webhook/*`

## Key Modules

### Authentication (`auth/`)

- Firebase JWT authentication
- User token validation
- Protected route guards

### Games (`games/`)

- Game creation and management
- Player join/approval workflow
- Game suggestion algorithm based on user preferences
- Payment status tracking
- Game status management (PLAYERS_REQUIRED, READY_TO_BOOK, READY, COMPLETED, CANCELLED)

### Stripe (`stripe/`)

- Payment intent creation
- Connected account management (Stripe Connect)
- Webhook handling (platform and connected account events)
- Transaction tracking
- Payout management
- Refund processing

See [STRIPE_WEBHOOKS.md](./STRIPE_WEBHOOKS.md) for detailed webhook setup.

### Notifications (`notifications/`)

- Push notification service
- Notification preferences
- Notification history
- Real-time notifications via WebSocket

### Conversations & Messages (`conversations/`, `messages/`)

- Direct messages
- Group conversations
- Game-specific conversations
- Real-time messaging via Socket.IO

### Courses (`courses/`)

- Golf course data management
- Course reviews
- Course condition reports
- Tee information and hole data
- Course search and filtering

### Posts (`posts/`)

- General posts
- Score posts (rounds of golf)
- Post likes and comments
- Group posts

### Images (`images/`, `image-processing/`)

- Image upload to S3
- Image processing and optimization
- Presigned URL generation

### Exception Tracking with Sentry (`shared/sentry.*`)

Comprehensive error tracking and monitoring for application exceptions.

#### Setup

1. Create a [Sentry account](https://sentry.io) and new Node.js project
2. Add to `.env`:
   ```env
   SENTRY_DSN=https://<key>@<organization>.ingest.sentry.io/<project-id>
   ```

#### Features

- **Automatic Error Capture**: All unhandled exceptions are automatically captured
- **Request Tracking**: HTTP request/response info included with errors
- **5xx Error Reporting**: Server errors sent to Sentry for monitoring
- **Performance Monitoring**: Request tracing (10% sample rate in production)
- **Profiling**: Application profiling for performance optimization
- **Smart Filtering**: 4xx errors stay local, 5xx errors tracked to Sentry

#### Configuration

- Production mode: Enabled by default, 10% trace sampling
- Development mode: Disabled by default
  - Enable with: `SENTRY_DEBUG=true NODE_ENV=development npm run start:dev`

#### Testing

Test error capture in development:

```bash
# Start with Sentry debug enabled
SENTRY_DEBUG=true NODE_ENV=development npm run start:dev

# Trigger an error
curl http://localhost:3000/api/invalid-endpoint
```

#### Customization

Add context to error reports:

```typescript
import * as Sentry from '@sentry/node';

Sentry.setUser({
  id: userId,
  email: userEmail,
});

Sentry.setTag('feature', 'payment');
Sentry.captureMessage('User action', 'info');
```

Adjust sample rates in `src/shared/sentry.config.ts`:

```typescript
tracesSampleRate: isProduction ? 0.1 : 1.0,  // 10% in prod, 100% in dev
profilesSampleRate: isProduction ? 0.1 : 1.0,
```

See `.env.sentry.example` for environment variable template.

## Development Guidelines

### Code Style

This project follows strict TypeScript and NestJS conventions. See `.cursor/rules/nestjs-rule.mdc` for detailed guidelines.

#### Key Principles

- **TypeScript**: Always declare types, avoid `any`
- **Naming**:
  - PascalCase for classes
  - camelCase for variables/functions
  - kebab-case for files/directories
- **Functions**: Short functions (< 20 instructions), single purpose
- **Classes**: Small classes (< 200 instructions, < 10 public methods)
- **SOLID Principles**: Follow SOLID design principles

### Module Structure

Each module should follow this structure:

```
module-name/
├── module-name.module.ts
├── module-name.controller.ts
├── module-name.service.ts
├── dto/
│   ├── create-module-name.dto.ts
│   └── update-module-name.dto.ts
├── entities/
│   └── module-name.entity.ts
└── module-name.controller.spec.ts
└── module-name.service.spec.ts
```

### DTOs

- Use `class-validator` decorators for validation
- Separate DTOs for create/update operations
- Use `class-transformer` for data transformation

### Database

- Use Prisma for all database operations
- Access Prisma via `PrismaService` (injected dependency)
- Use transactions for multi-step operations
- Implement soft deletes using `deleted_at` field

### Error Handling

- Use NestJS exception filters for global error handling
- Throw appropriate HTTP exceptions (`BadRequestException`, `NotFoundException`, etc.)
- Log errors appropriately

### Testing

- Write unit tests for all services
- Write E2E tests for all controllers
- Follow Arrange-Act-Assert pattern
- Use test doubles for dependencies

### Git Workflow

- Create feature branches from `main`
- Use descriptive commit messages
- Submit pull requests for review

## Deployment

### Pre-deployment Checklist

1. ✅ All environment variables configured
2. ✅ Database migrations applied
3. ✅ Prisma client generated
4. ✅ Tests passing
5. ✅ Build succeeds without errors
6. ✅ Stripe webhooks configured (see [STRIPE_WEBHOOKS.md](./STRIPE_WEBHOOKS.md))

### Build for Production

```bash
npm run build
```

This creates a `dist/` directory with compiled JavaScript.

### Production Start

```bash
npm run start:prod
```

This command:

1. Generates Prisma client
2. Builds the application
3. Starts the server

### Environment-Specific Configuration

- Use different `.env` files for different environments
- Never commit `.env` files to version control
- Use environment variable management in your deployment platform

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check database is running
pg_isready

# Verify DATABASE_URL in .env
echo $DATABASE_URL
```

#### Prisma Client Not Generated

```bash
npx prisma generate
```

#### Port Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

#### Stripe Webhook Signature Verification Fails

- Ensure raw body parsing is enabled (configured in `main.ts`)
- Verify webhook secret matches Stripe Dashboard
- Check endpoint URL is correct

#### Firebase Authentication Errors

- Verify Firebase credentials in `.env`
- Check Firebase project is active
- Ensure private key is properly formatted with `\n` characters

### Debugging

#### Enable Debug Logging

Set `NODE_ENV=development` for verbose logging.

#### Database Queries

Use Prisma Studio to inspect database:

```bash
npx prisma studio
```

#### API Testing

Use Swagger UI at `http://localhost:3000/api` or tools like Postman/Insomnia.

## Additional Resources

- [NestJS Documentation](https://docs.nestjs.com)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Stripe API Documentation](https://stripe.com/docs/api)
- [Firebase Admin SDK](https://firebase.google.com/docs/admin/setup)
- [Socket.IO Documentation](https://socket.io/docs/v4/)

## Support

For questions or issues:

1. Check existing documentation
2. Review code comments and JSDoc
3. Consult team members
4. Check project issues/PRs

---

**Note**: This is a private, unlicensed project. All rights reserved.
