# Alba Documentation Index

Complete documentation for the Alba golf mobile app. This folder contains architecture, standards, and project guidance.

---

## Quick Navigation

### For New Developers 👨‍💻

1. **[Project Overview & PDR](./project-overview-pdr.md)** — Start here
   - Product vision and features
   - Core requirements
   - Architecture overview
   
2. **[Codebase Summary](./codebase-summary.md)** — Understand the structure
   - Directory layout
   - Key files and their purpose
   - Technology stack
   - Quick facts about the codebase

3. **[Code Standards](./code-standards.md)** — Before you code
   - TypeScript conventions
   - Component patterns
   - API design
   - Testing standards
   - Performance tips

4. **[System Architecture](./system-architecture.md)** — Deep dive
   - Data flow diagrams
   - Authentication flow
   - State management patterns
   - API architecture
   - Real-time communication (WebSockets)

### For DevOps & Release 🚀

5. **[Deployment Guide](./deployment-guide.md)** — Build and release
   - EAS Build setup
   - Build profiles (development, preview, production)
   - App Store & Google Play submission
   - OTA updates
   - Troubleshooting

### For Product & Planners 📋

6. **[Project Roadmap](./project-roadmap.md)** — Roadmap and planning
   - Current status (v1.1.1)
   - Completed phases
   - In-progress work (v1.2 testing)
   - Planned features (v2.0+)
   - Timeline and metrics

---

## Document Overview

| Document | Purpose | Audience | Read Time |
|----------|---------|----------|-----------|
| **project-overview-pdr.md** | Product vision, requirements, architecture overview | Product, Engineering | 15 min |
| **codebase-summary.md** | Codebase structure, file organization, tech stack | Developers, New hires | 10 min |
| **code-standards.md** | Coding conventions, patterns, best practices | Developers | 20 min |
| **system-architecture.md** | Technical architecture, data flow, design patterns | Tech leads, Architects | 20 min |
| **deployment-guide.md** | Build, release, and OTA update procedures | DevOps, Release managers | 15 min |
| **project-roadmap.md** | Roadmap, priorities, metrics, risk mitigation | Product, Engineering | 15 min |

---

## Key Information at a Glance

### Tech Stack
- **Runtime:** Expo SDK 54, React Native 0.81, React 19
- **Routing:** expo-router (file-based)
- **State:** Zustand + React Context
- **HTTP:** Axios
- **Real-time:** socket.io-client
- **Auth:** Firebase
- **Payments:** Stripe
- **Maps:** Mapbox
- **Testing:** Jest + React Testing Library
- **Build:** EAS Build & EAS Update

### Project Structure
```
app/              → Routes (expo-router)
components/       → Reusable UI components
hooks/            → Business logic & data fetching
api/              → REST API wrappers
stores/           → Zustand global state
providers/        → React Context providers
constants/        → Design tokens & config
utils/            → Pure utility functions
types/            → TypeScript definitions
assets/           → Images, fonts, icons
```

### Development Commands
```bash
npm start          # Start Expo dev server
npm test           # Run Jest test suite
npm run lint       # Run ESLint
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

### Build Commands
```bash
eas build --profile development              # Development build
eas build --profile preview --platform ios   # Preview build
eas build --profile production               # Production build
eas submit --profile production              # Submit to stores
eas update --channel production              # OTA update
```

---

## Current Project Status

| Phase | Version | Status | Date |
|-------|---------|--------|------|
| **Phase 1** | 1.0.0 | ✅ Complete | Apr 2024 |
| **Phase 2** | 1.1.0 | ✅ Complete | May 2024 |
| **Phase 3** | 1.1.1 | ✅ Complete | Jun 2024 |
| **Phase 4** | 1.2.0 | 🔄 In Progress | Jul–Aug 2024 |
| **Phase 5** | 2.0.0 | 📋 Planned | Q4 2024 |

**Current Focus:** Testing & Quality Assurance (v1.2.0)
- Increase test coverage to 75%+
- Reduce critical bugs
- Improve stability

See [project-roadmap.md](./project-roadmap.md) for full details.

---

## Related Root Documentation

- **[README.md](../README.md)** — Project setup, prerequisites, scripts
- **[TESTING.md](../TESTING.md)** — Test strategy for complaints feature
- **[NOTIFICATION_SETUP.md](../NOTIFICATION_SETUP.md)** — Push notification configuration
- **[NOTIFICATION_INTEGRATION.md](../NOTIFICATION_INTEGRATION.md)** — Backend notification flows
- **[MAPBOX_SETUP.md](../MAPBOX_SETUP.md)** — Mapbox configuration
- **[REFACTORING_SUMMARY.md](../REFACTORING_SUMMARY.md)** — Game detail refactoring history

---

## Common Tasks

### I want to...

**...understand the product** → [project-overview-pdr.md](./project-overview-pdr.md) + [project-roadmap.md](./project-roadmap.md)

**...start coding** → [codebase-summary.md](./codebase-summary.md) + [code-standards.md](./code-standards.md)

**...add a new feature** → [code-standards.md](./code-standards.md) + [system-architecture.md](./system-architecture.md)

**...understand how X works** → [system-architecture.md](./system-architecture.md) (auth, state, API, real-time)

**...write tests** → [code-standards.md](./code-standards.md) → Testing section + ../TESTING.md

**...build and release** → [deployment-guide.md](./deployment-guide.md)

**...see what's next** → [project-roadmap.md](./project-roadmap.md)

**...fix a bug** → [system-architecture.md](./system-architecture.md) for context + [code-standards.md](./code-standards.md) for patterns

**...optimize performance** → [code-standards.md](./code-standards.md) → Performance section + [system-architecture.md](./system-architecture.md)

**...improve accessibility** → [code-standards.md](./code-standards.md) → Accessibility section

---

## Quick Reference

### File Size Targets
- Components: < 150 lines
- Hooks: < 100 lines
- Screens: < 250 lines
- API files: < 200 lines

### Test Coverage
- **Minimum:** 70% (enforced by Jest config)
- **Target:** 75%+
- **By category:** Components 70%, Hooks 80%, Utils 85%

### Naming Conventions
- **Directories:** kebab-case (`components/game-detail`)
- **Components:** PascalCase (`GameCard.tsx`)
- **Hooks:** lowercase (`useGameDetail.ts`)
- **Constants:** UPPER_SNAKE_CASE (`DEFAULT_TIMEOUT`)
- **Variables:** camelCase (`isLoading`, `hasError`)
- **Booleans:** `is*`, `has*` prefix (`isOrganizer`, `hasError`)

### Path Aliases
```typescript
import { GameCard } from '@/components/GameCard';
import { useGameDetail } from '@/hooks/useGameDetail';
import { fetchGames } from '@/api/games';
```

### Code Structure (Components)
1. Imports
2. Type definitions & interfaces
3. Sub-components
4. Helper functions
5. Main component
6. Export

### API Request Pattern
```typescript
const token = await auth.currentUser?.getIdToken();
const { data } = await axios.get(buildApiUrl('endpoint'), {
  ...DEFAULT_CONFIG,
  headers: { ...DEFAULT_CONFIG.headers, 'Authorization': `Bearer ${token}` },
});
```

---

## Getting Help

### Documentation
- **API questions?** → [system-architecture.md](./system-architecture.md) → API Architecture section
- **State management questions?** → [system-architecture.md](./system-architecture.md) → State Management Architecture
- **Component/hook patterns?** → [code-standards.md](./code-standards.md)
- **Build/release questions?** → [deployment-guide.md](./deployment-guide.md)

### External Resources
- [Expo Documentation](https://docs.expo.dev/)
- [React Native Docs](https://reactnative.dev/docs/getting-started)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Stripe Mobile Docs](https://stripe.com/docs/stripe-js)

### Project Chat
- Questions about specific code? → Check Git blame, PR comments
- Questions about architecture? → Create a discussion in GitHub
- Questions about product? → Contact Product Lead

---

## Documentation Maintenance

### Keeping Docs Up-to-Date

These docs should be updated when:
- **Architecture changes** → Update system-architecture.md
- **Code standards change** → Update code-standards.md
- **New feature releases** → Update project-roadmap.md + codebase-summary.md
- **Build process changes** → Update deployment-guide.md
- **Onboarding improves** → Update this README.md

### How to Update
1. Read the relevant doc file
2. Identify what changed in the code
3. Update the doc section(s)
4. Commit with clear message: `docs: update X for Y feature`

### Version Control
- Docs are versioned with the code
- Keep docs in sync with releases
- Use conventional commit messages (`docs: ...`)

---

## FAQ

**Q: Where do I find the API endpoints?**
A: See [system-architecture.md](./system-architecture.md) → API Architecture section. Each endpoint is in a domain-specific file under `api/`.

**Q: How do I add a new hook?**
A: See [code-standards.md](./code-standards.md) → Custom Hooks section for the template.

**Q: What's the test coverage target?**
A: 70% minimum (enforced), target 75%+. See [code-standards.md](./code-standards.md) → Testing Standards.

**Q: How do I deploy to production?**
A: See [deployment-guide.md](./deployment-guide.md) → Build Process section.

**Q: Can I use enums?**
A: No, use object maps instead. See [code-standards.md](./code-standards.md) → TypeScript & Language Standards.

**Q: What's the max component size?**
A: 150 lines for components, 100 for hooks. See [code-standards.md](./code-standards.md) → File Size Management.

**Q: How do I handle errors?**
A: Try-catch with Sentry logging. See [code-standards.md](./code-standards.md) → Error Handling.

**Q: What's coming next?**
A: See [project-roadmap.md](./project-roadmap.md) for the full roadmap. v1.2 (testing), v2.0 (advanced features).

---

## Feedback

Found an issue with the docs? Missing something important?

- **For factual errors:** Create an issue or PR
- **For clarifications:** Ask in team chat
- **For reorganization:** Discuss with tech lead

---

**Last Updated:** June 2024  
**Maintained by:** Engineering Team  
**Next Review:** August 2024

