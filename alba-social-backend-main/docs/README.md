# Alba Social Backend - Documentation Index

Welcome to the Alba Social Backend documentation. This directory contains comprehensive guides for understanding, developing, and deploying the golf social networking platform.

---

## Quick Navigation

### For New Developers
1. **[Project Overview & PDR](./project-overview-pdr.md)** — Start here to understand what Alba is and the product roadmap
2. **[Codebase Summary](./codebase-summary.md)** — High-level overview of the 32+ modules and their responsibilities
3. **[Code Standards](./code-standards.md)** — Coding conventions, NestJS patterns, testing strategy
4. **[System Architecture](./system-architecture.md)** — How components interact, data flows, external integrations

### For Architects & Tech Leads
- **[System Architecture](./system-architecture.md)** — Detailed layered architecture, request/response flows, payment workflows
- **[Database Schema](./database-schema.md)** — 32 entities, relationships, constraints, indexes
- **[Project Roadmap](./project-roadmap.md)** — 8 phases of development with timelines and success criteria

### For DevOps & Operations
- **[Deployment Guide](./deployment-guide.md)** — Local setup, Docker, Heroku, AWS EC2, GCP Cloud Run
- **[System Architecture](./system-architecture.md#deployment-architecture)** — Infrastructure setup, monitoring, scaling

### For Payment/Integration Engineers
- **[Project Overview — Payment Section](./project-overview-pdr.md#requirement-set-3-payment--stripe)** — Payment requirements and workflow
- **[System Architecture — Payment Flow](./system-architecture.md#payment--stripe-flow-complex-workflow)** — Detailed Stripe integration
- **[Database Schema — Payments](./database-schema.md#payments--transactions)** — Transaction models and audit trail
- **See also:** `STRIPE_WEBHOOKS.md` and `CRON.md` in repository root

### For Security & Compliance
- **[Code Standards — Security](./code-standards.md#error-handling)** — Authentication, authorization, error handling
- **[System Architecture — Security](./system-architecture.md#security-considerations)** — Data protection, webhook verification, CORS

---

## Document Overview

### [project-overview-pdr.md](./project-overview-pdr.md) — 11 KB
**Purpose:** Define the product vision, features, requirements, and success metrics  
**Audience:** Product managers, stakeholders, all team members  
**Contents:**
- Executive summary and product overview
- Core features and workflow
- Product Development Requirements (PDR) for 8 feature areas
- Non-functional requirements (performance, security, testing)
- Acceptance criteria and success metrics
- Risk mitigation strategies
- Known limitations and future roadmap

---

### [codebase-summary.md](./codebase-summary.md) — 20 KB
**Purpose:** Navigate the 32+ modules and understand their roles  
**Audience:** Developers, architects  
**Contents:**
- Module-by-module inventory (games, payments, notifications, etc.)
- Key data model patterns (user-centric, game-centric, financial)
- API conventions and practices
- Testing strategy
- ~211 TypeScript files across modular architecture
- Notable implementation details (soft deletes, Stripe integration, real-time chat)

---

### [code-standards.md](./code-standards.md) — 26 KB
**Purpose:** Define coding standards, patterns, and best practices  
**Audience:** Developers (reference during coding)  
**Contents:**
- NestJS module structure and dependency injection
- TypeScript conventions (naming, types, generics)
- Service layer responsibilities and error handling
- Controller layer patterns and authorization
- DTO validation and transformation
- Database access via Prisma (queries, soft deletes, indexes)
- Authentication and role-based access control
- Testing patterns (AAA, mocking)
- Code style (formatting, comments, function length)
- SOLID principles with examples
- Logging and monitoring

---

### [system-architecture.md](./system-architecture.md) — 30 KB
**Purpose:** Understand how all components fit together  
**Audience:** Architects, senior developers, DevOps  
**Contents:**
- High-level architecture diagram (clients → API → services → database)
- Detailed layered architecture (HTTP, business logic, data access, WebSocket)
- External integrations (Stripe, Firebase, S3, Google Maps, Expo, Claude)
- Request/response flow examples
- Complex payment workflow and dispute resolution
- Data model overview (32 entities)
- Key design decisions with rationale
- Performance considerations (indexes, caching, pagination)
- Security architecture
- Deployment infrastructure
- Monitoring and observability
- Scalability and disaster recovery

---

### [database-schema.md](./database-schema.md) — 29 KB
**Purpose:** Reference for all database entities and relationships  
**Audience:** Developers, DBAs  
**Contents:**
- Prisma schema as documented code (all 32 entities)
- User & authentication models
- Game management and player tracking
- Course and round scoring
- Payment and transaction models
- Social features (posts, comments, follows)
- Messaging and conversations
- Notifications and moderation
- Marketing attribution
- League and tournament support
- Enumerations for all status types
- Unique constraints and indexes
- Soft delete pattern
- Detailed explanation of each entity

---

### [deployment-guide.md](./deployment-guide.md) — 16 KB
**Purpose:** Step-by-step instructions for deploying Alba  
**Audience:** DevOps, SREs, deployment engineers  
**Contents:**
- Pre-deployment checklist
- Environment variables reference
- Local development setup (5 steps)
- Building for production
- Docker deployment (build, run, compose)
- Production deployment options (Heroku, AWS EC2, GCP Cloud Run)
- Database migration strategy
- Post-deployment verification and testing
- Monitoring and logging setup
- Scaling and optimization
- Disaster recovery and backups
- Security hardening
- Troubleshooting common issues
- Comprehensive deployment checklist

---

### [project-roadmap.md](./project-roadmap.md) — 16 KB
**Purpose:** Long-term product and technical vision  
**Audience:** Product managers, executives, team leads  
**Contents:**
- 8 development phases (MVP → Marketplace)
- Timeline and status for each phase
- Feature breakdown and success criteria
- Technical debt and improvements
- Metrics and KPIs by phase
- Risk management matrix
- Decision log with rationale
- Feature priority matrix
- Detailed phase descriptions with deliverables

---

## File Sizes & Stats

| Document | Size | Lines | Focus |
|----------|------|-------|-------|
| project-overview-pdr.md | 11 KB | 350 | Product requirements |
| codebase-summary.md | 20 KB | 600 | Module architecture |
| code-standards.md | 26 KB | 800 | Development standards |
| system-architecture.md | 30 KB | 900 | System design |
| database-schema.md | 29 KB | 900 | Data model |
| deployment-guide.md | 16 KB | 500 | Operations |
| project-roadmap.md | 16 KB | 500 | Product vision |
| **Total** | **148 KB** | **4450** | Complete coverage |

---

## How to Use This Documentation

### Scenario 1: "I'm joining the team"
1. Read [project-overview-pdr.md](./project-overview-pdr.md) (15 min)
2. Read [codebase-summary.md](./codebase-summary.md) (20 min)
3. Skim [code-standards.md](./code-standards.md) (10 min)
4. Reference [system-architecture.md](./system-architecture.md) as you explore code (30 min)
5. Set up local environment using [deployment-guide.md](./deployment-guide.md) (30 min)

### Scenario 2: "I need to add a new feature"
1. Review feature in [project-roadmap.md](./project-roadmap.md)
2. Check [code-standards.md](./code-standards.md) for patterns
3. Find relevant module in [codebase-summary.md](./codebase-summary.md)
4. Reference [system-architecture.md](./system-architecture.md) for interaction points
5. Check [database-schema.md](./database-schema.md) if data model changes needed

### Scenario 3: "I'm debugging a payment issue"
1. Review payment flow in [system-architecture.md](./system-architecture.md#payment--stripe-flow-complex-workflow)
2. Check Transaction models in [database-schema.md](./database-schema.md#payments--transactions)
3. Review StripeService in [codebase-summary.md](./codebase-summary.md#srcstripe-600-loc)
4. See STRIPE_WEBHOOKS.md in repository root for webhook details

### Scenario 4: "I'm deploying to production"
1. Follow [deployment-guide.md](./deployment-guide.md) step-by-step
2. Use pre-deployment checklist
3. Review environment variables section
4. Choose deployment platform (Heroku/AWS/GCP)
5. Run post-deployment verification tests

### Scenario 5: "I'm reviewing system design"
1. Start with [system-architecture.md](./system-architecture.md) overview
2. Review layered architecture sections
3. Check design decisions and rationale
4. Review [database-schema.md](./database-schema.md) for data integrity
5. Audit [code-standards.md](./code-standards.md) for implementation patterns

---

## Key Concepts

### Alba Platform
A golf social networking platform enabling users to discover games, join with friends, manage payments, and share scores—all in one app.

### Core Domains
- **Users & Auth:** Firebase JWT, profiles, onboarding
- **Games:** Posting, recommendations, player approval, status workflow
- **Payments:** Stripe Connect, 2-day holds, dispute resolution
- **Social:** Posts, comments, follows, groups, leaderboards
- **Messaging:** WebSocket chat, conversations, notifications
- **Moderation:** Blocking, reporting, complaints

### Architecture
- **Frontend:** Mobile (Expo iOS/Android), Web (React)
- **Backend:** NestJS 10 + TypeScript 5
- **Database:** PostgreSQL 14+ with Prisma ORM
- **External Services:** Stripe, Firebase, AWS S3, Google Maps, Expo, Mapbox

### Key Integrations
- **Stripe Connect** → Organizer payouts, payment holds
- **Firebase Admin SDK** → User authentication (JWT)
- **AWS S3** → Image storage
- **Socket.IO** → Real-time chat
- **Expo** → Push notifications
- **Google Maps** → Location services

---

## Related Documentation

**In Repository Root:**
- `README.md` — Project overview and quick start
- `STRIPE_WEBHOOKS.md` — Stripe webhook setup and testing
- `CRON.md` — Scheduled jobs (notification runner)

**In Code:**
- `.cursor/rules/nestjs-rule.mdc` — NestJS conventions (reference in code-standards.md)
- `.env.sentry.example` — Sentry configuration template
- `prisma/schema.prisma` — Database schema (993 lines, documented in database-schema.md)
- `src/main.ts` — Application bootstrap
- `src/app.module.ts` — Module wiring

---

## Contributing to Documentation

When updating documentation:
1. Keep files focused (target: <800 lines each)
2. Update this index if adding new documents
3. Cross-reference related sections
4. Verify all code examples are current
5. Update timestamps and status indicators
6. Run `npm run lint` to check formatting

---

## Support & Questions

**For technical questions:**
- Check the relevant documentation section
- Search codebase comments
- Review recent commits for context
- Ask team members via Slack/Discord

**For missing documentation:**
- Create an issue or PR
- Describe what's missing
- Suggest where it should live

**For corrections:**
- Submit a PR with fixes
- Note what was inaccurate
- Provide correct information

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | June 19, 2026 | Initial documentation created from codebase analysis |
| TBD | TBD | Post-launch updates and refinements |

---

## Last Updated
June 19, 2026 — Documentation initialized for Alba Social Backend MVP

**Next Review:** Post-launch (Q3 2026) for Phase 2 updates
