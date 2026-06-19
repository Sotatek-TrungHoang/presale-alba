# Alba Project Roadmap

Strategic roadmap outlining features, milestones, and priorities for the Alba golf mobile app.

---

## Current Status

| Phase | Status | Version | Target |
|-------|--------|---------|--------|
| MVP Launch | ✅ Complete | 1.0.0 | Apr 2024 |
| V1.1 (Payments) | ✅ Complete | 1.1.0 | May 2024 |
| V1.1.1 (Refactoring) | ✅ Complete | 1.1.1 | Jun 2024 |
| V1.2 (Testing & QA) | 🔄 In Progress | 1.2.0 | Jul 2024 |
| V2.0 (Advanced Features) | 📋 Planned | 2.0.0 | Q4 2024 |

---

## Phase 1: MVP Launch (Apr 2024) ✅ Complete

**Status:** Released (v1.0.0)

### Features Delivered
- ✅ Multi-method authentication (email, Google, Apple, Facebook)
- ✅ 7-step onboarding wizard
- ✅ Game discovery & listing
- ✅ Game creation & management
- ✅ Join requests & organizer approval
- ✅ Real-time game chat (WebSocket)
- ✅ Direct messaging
- ✅ User profiles & follow/block
- ✅ Push notifications
- ✅ Mapbox course discovery
- ✅ Game state transitions (CREATED → READY → IN_PROGRESS → COMPLETED)

### Tech Foundation
- React Native 0.81, Expo SDK 54, expo-router
- Firebase authentication
- Zustand for global state
- Socket.io for real-time chat
- Jest with 70%+ coverage target

### Metrics
- iOS App Store: ✅ Released
- Google Play: ✅ Released
- Users: ~100 (beta/friends)
- Crash-free rate: 99%+

---

## Phase 2: Payment Integration (May 2024) ✅ Complete

**Status:** Released (v1.1.0)

### Features Delivered
- ✅ Stripe integration (@stripe/stripe-react-native)
- ✅ Organizer Stripe onboarding (bank verification)
- ✅ Player payment collection (green fees)
- ✅ Payment state tracking (PENDING → PAID → REFUNDED)
- ✅ Payout management
- ✅ Transaction history
- ✅ Refund processing
- ✅ Payment error handling & user messaging

### Tech Additions
- Stripe webhook support (backend)
- Payment confirmation modals
- stripeOnboardingStore (Zustand)

### Metrics
- 100% test coverage for payment flows
- Zero payment-related crashes
- Stripe compliance verified

---

## Phase 3: Refactoring & Maintainability (Jun 2024) ✅ Complete

**Status:** Released (v1.1.1)

### Deliverables
- ✅ Game detail screen refactored (1,255 → 277 lines)
  - Split into: OrganizerView, PlayerView, GameBottomActions
  - Extracted hooks: useGameDetail, useGameActions
- ✅ Component modularization
- ✅ Code quality improvements
- ✅ Performance optimizations
- ✅ Test refactoring & isolation

### Documentation
- REFACTORING_SUMMARY.md — Refactoring approach & rationale
- Updated code-standards.md with best practices
- Added component architecture guidelines

### Metrics
- Avg component size: 120 lines (target: < 150)
- Test coverage maintained at 70%+
- Build time stable

---

## Phase 4: Testing & Quality Assurance (In Progress) 🔄

**Status:** Q2–Q3 2024 (v1.2.0)

### Goals
- Increase test coverage from 70% → 75%+
- Reduce critical bugs by 50%
- Improve app stability & performance
- Comprehensive integration testing

### Tasks

#### Unit Tests
- [ ] Complete hook tests (useGameDetail, useGameActions, useNotifications)
- [ ] Component tests for all UI components in `components/ui/`
- [ ] API wrapper tests (games, courses, user, stripe)
- [ ] Utility function tests (formatters, validators)

#### Integration Tests
- [ ] Auth flow (login → onboarding → home)
- [ ] Game creation flow (create → invite → payment → complete)
- [ ] Real-time chat (message send/receive, typing indicators)
- [ ] Payment flow (Stripe onboarding → payment → refund)

#### Performance Tests
- [ ] App startup time < 3s
- [ ] Screen transition < 500ms
- [ ] List scrolling 60 FPS
- [ ] Memory usage on large lists

#### Device Tests
- [ ] iOS 13–17 compatibility
- [ ] Android 7–14 compatibility
- [ ] Small screens (iPhone SE, iPhone 13 mini)
- [ ] Large screens (iPhone Max, Android tablets)

#### Network Tests
- [ ] Offline game list (cache fallback)
- [ ] Slow network (connection timeout handling)
- [ ] Network switch (WiFi → cellular)
- [ ] WebSocket reconnection

### Deliverables
- [ ] Comprehensive test suite (target: 250+ tests)
- [ ] Test coverage report (≥75%)
- [ ] Performance benchmarks
- [ ] Device compatibility matrix
- [ ] Sentry error monitoring dashboard

### Metrics
- Test coverage: 70% → 75%+
- Critical bugs: < 5 per release
- App crash rate: < 0.1%
- Average issue resolution: < 48 hours

---

## Phase 5: Advanced Features (Q4 2024) 📋 Planned

**Status:** v2.0.0 target

### Features in Consideration

#### A. Scoring & Leaderboards
- In-game score tracking
- Hole-by-hole scoring
- Course leaderboards (all-time, monthly, friends)
- Handicap calculation & tracking
- Handicap integration (GHIN)

**Effort:** Medium (API + UI)
**Priority:** High
**Owner:** TBD

#### B. Tournament & League System
- Create multi-week tournaments
- League standings & rankings
- Prize pool management
- Division-based matchmaking

**Effort:** Large (complex state)
**Priority:** Medium
**Owner:** TBD

#### C. In-App Replay & Analytics
- Replay game rounds (map route, scores, timeline)
- Analytics dashboard (rounds played, average score, favorite courses)
- Shot tracking (distance, club used)
- Performance trends (weekly, monthly, yearly)

**Effort:** Large (video, real-time data)
**Priority:** Medium
**Owner:** TBD

#### D. Friend Groups & Team Management
- Create groups of friends
- Group-specific game invites
- Team vs. team games
- Group leaderboards

**Effort:** Medium (schema + UI)
**Priority:** Medium
**Owner:** TBD

#### E. Social Feed
- Activity feed (games, achievements, milestones)
- Game recap sharing
- Comments & reactions
- Hashtag support (#albaGolf #courseReview)

**Effort:** Medium (API + infinite scroll)
**Priority:** Low
**Owner:** TBD

#### F. Web Dashboard (Organizer)
- Web-based organizer portal
- Game management (create, edit, cancel, payouts)
- Player roster & status
- Analytics & reporting
- Payout history

**Effort:** Large (full web app)
**Priority:** Medium
**Owner:** TBD

#### G. Improved Notifications
- Smart notification scheduling (don't notify during work hours)
- Notification channels (games, messages, achievements)
- Notification frequency preferences
- Rich notifications with images

**Effort:** Small (config + UI)
**Priority:** High
**Owner:** TBD

#### H. Offline Support
- Cache game list & course details
- Queue messages & requests offline
- Sync when online
- Offline game state tracking (local storage)

**Effort:** Medium (AsyncStorage + sync logic)
**Priority:** Medium
**Owner:** TBD

#### I. Referral Program
- Invite friends (SMS, link)
- Referral rewards (course credits, free games)
- Referral tracking & payouts
- Leaderboard (top referrers)

**Effort:** Medium (backend + UI)
**Priority:** Low
**Owner:** TBD

#### J. Sponsor & Brand Integration
- In-app ads (minimal, unobtrusive)
- Sponsor course listings
- Brand partnerships (golf equipment, apparel)
- Sponsored game listings

**Effort:** Large (complex)
**Priority:** Low
**Owner:** TBD

### Q4 2024 Candidate (Highest Priority)
1. **Scoring & Leaderboards** — Core golf feature
2. **Tournament System** — Differentiate from competitors
3. **Web Dashboard** — Organizer retention
4. **Improved Notifications** — User experience

---

## Phase 6: International Expansion (Q1 2025) 📋 Planned

**Status:** Post-v2.0

### Goals
- Support English + 3 additional languages
- Regional course data (UK, EU, Australia, Canada)
- Local payment methods (region-specific)
- Currency localization

### Tasks
- [ ] Implement i18n (react-i18next or similar)
- [ ] Translate UI strings to: Spanish, French, German, Japanese
- [ ] Regional course databases
- [ ] Local Stripe payment methods
- [ ] Regional push notification services
- [ ] Testing on regional devices

### Metrics
- Support ≥ 4 languages
- 80%+ translation coverage
- Regional user signup > 20%

---

## Phase 7: Infrastructure & Performance (Ongoing) ⚙️

**Status:** Continuous

### Ongoing Tasks
- [ ] Sentry monitoring & alerting setup
- [ ] Performance benchmarking (Lighthouse, WebPageTest equivalent for mobile)
- [ ] CI/CD optimization (build time reduction)
- [ ] Dependency updates & security patches
- [ ] Load testing (API capacity planning)
- [ ] Beta testing program (100+ beta testers)

### Success Metrics
- Build time: < 45 min (iOS), < 35 min (Android)
- API latency (p95): < 5s
- Crash-free users: > 99%
- Sentry error detection: < 24h
- Zero critical vulnerabilities

---

## Timeline Overview

```
2024
Q1          Q2                      Q3                  Q4
├─ MVP      ├─ Payments ─────────┬─ Refactoring ──┬─ Testing ───────┬─ Advanced Features
│           │                    │                │                │
v1.0.0    v1.1.0              v1.1.1          v1.2.0           v2.0.0
(Apr)     (May)               (Jun)           (Jul–Aug)        (Oct–Nov)
                                              ↓
                                        + Scoring
                                        + Leaderboards
                                        + Tournaments
                                        + Web Dashboard
```

---

## Success Metrics & KPIs

### App Metrics
| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Daily Active Users (DAU) | 500+ | 100 | Product |
| Monthly Active Users (MAU) | 2000+ | ~400 | Product |
| Game completion rate | > 90% | TBD | Product |
| User retention (DAU/MAU) | > 25% | TBD | Product |
| App rating (stores) | ≥ 4.5 | TBD | QA |
| Crash-free users | > 99% | 99.5% | Mobile/Sentry |

### Technical Metrics
| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Test coverage | ≥ 75% | 70% | Mobile/QA |
| CI/CD success rate | > 99% | TBD | DevOps |
| API uptime | ≥ 99.5% | TBD | Backend |
| API latency (p95) | < 5s | TBD | Backend |
| App startup time | < 3s | TBD | Mobile |
| Build time | < 45 min | TBD | DevOps |

### Business Metrics
| Metric | Target | Current | Owner |
|--------|--------|---------|-------|
| Revenue per game | $5–10 | TBD | Finance |
| Organizer payout rate | > 90% | TBD | Finance |
| Payment success rate | > 99% | TBD | Finance |
| Organizer retention | > 60% | TBD | Product |
| User acquisition cost | < $5 | TBD | Marketing |
| Customer lifetime value | > $50 | TBD | Product |

---

## Risk & Mitigation

### Technical Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| WebSocket reliability | High | Implement fallback polling, test reconnection | Mobile |
| Payment processing errors | High | Stripe redundancy, manual refund flow | Backend |
| iOS/Android divergence | Medium | Test on both platforms, shared test suite | Mobile |
| Firebase quota limits | Medium | Monitor usage, implement rate limiting | Backend |
| Third-party API outages | Medium | Graceful degradation, user messaging | Mobile |

### Product Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Low user engagement | High | Improve UX, add social features | Product |
| Competitor pressure | High | Differentiate (tournaments, analytics) | Product |
| Payment method friction | Medium | Support multiple methods, one-click checkout | Product |
| Organizer churn | Medium | Better tools, community building | Product |

### Market Risks

| Risk | Impact | Mitigation | Owner |
|------|--------|-----------|-------|
| Limited target market | High | Expand to casual golfers, juniors | Marketing |
| Geographic constraints | Medium | Plan international expansion | Product |
| Seasonal demand | Medium | Add indoor/off-season features | Product |

---

## Decision Log

### Approved Decisions

| Date | Feature | Decision | Rationale |
|------|---------|----------|-----------|
| Apr 2024 | Real-time Chat | Use socket.io | Low latency, proven in production |
| May 2024 | Payments | Use Stripe | PCI compliance, developer experience |
| Jun 2024 | State Management | Use Zustand | Lightweight, flexible, TypeScript support |
| Jun 2024 | Refactoring | Modularize large components | Maintainability, testability |

### Pending Decisions

| Feature | Options | Due Date | Owner |
|---------|---------|----------|-------|
| Scoring System | In-app (local), backend-calculated, hybrid | Aug 2024 | Product |
| Web Dashboard | Next.js, React, Vue | Sep 2024 | Tech Lead |
| Internationalization | i18next, lingui, custom | Oct 2024 | Product |
| Sponsorship Model | In-app ads, course partnerships, both | Nov 2024 | Product |

---

## Dependencies & Blockers

### Current Blockers
- [ ] **None** — Phase 4 (testing) can proceed independently

### Upcoming Dependencies
- Phase 5 (Advanced Features) depends on Phase 4 (testing) ✓
- Phase 6 (International) depends on Phase 5 stabilization
- Phase 7 (Infrastructure) runs in parallel, not blocking

---

## Resource Allocation

### Team Composition (Target)

| Role | Count | Sprint Allocation |
|------|-------|-------------------|
| Mobile Developer | 2 | 100% |
| Backend Developer | 1 | 50% (shared) |
| QA/Tester | 1 | 100% |
| DevOps/Infra | 1 | 25% (shared) |
| Product Manager | 1 | 30% |
| Designer | 1 | 20% (for Phase 5+) |

### Budget Estimate

| Phase | Cost | Timeline |
|-------|------|----------|
| Phase 1–3 | Completed | Apr–Jun 2024 |
| Phase 4 | $15K | Jul–Aug 2024 |
| Phase 5 | $50K–75K | Sep–Nov 2024 |
| Phase 6 | $25K–40K | Dec 2024–Jan 2025 |
| Phase 7 (Annual) | $30K–50K | Ongoing |

---

## Release Schedule

### Upcoming Releases

| Version | Type | Target Date | Key Features |
|---------|------|-------------|--------------|
| 1.2.0 | Minor | Jul 2024 | Test coverage ≥75%, bug fixes |
| 1.2.1 | Patch | Aug 2024 | Stability improvements |
| 2.0.0 | Major | Oct–Nov 2024 | Scoring, tournaments, web dashboard |
| 2.1.0 | Minor | Dec 2024 | International support |
| 2.2.0 | Minor | Jan 2025 | Advanced analytics, replay |

---

## Communication & Reporting

### Status Updates
- **Weekly:** Team standup (progress, blockers)
- **Bi-weekly:** Stakeholder update (features, metrics)
- **Monthly:** Product review (roadmap adjustments, retrospective)

### Roadmap Reviews
- **Q3 2024:** Review Phase 5 feature set (Jul 2024)
- **Q4 2024:** Review Phase 6 requirements (Oct 2024)
- **2025 Planning:** Annual planning & budget (Dec 2024)

---

## Appendix: Feature Scoring

Features prioritized by impact × effort:

| Feature | Impact | Effort | Score | Priority |
|---------|--------|--------|-------|----------|
| Scoring & Leaderboards | High (10) | Medium (5) | 50 | 🔴 High |
| Tournament System | High (9) | Large (7) | 43 | 🔴 High |
| Web Dashboard | Medium (8) | Large (7) | 32 | 🟡 Medium |
| Offline Support | Medium (7) | Medium (5) | 28 | 🟡 Medium |
| Friend Groups | Medium (7) | Medium (5) | 28 | 🟡 Medium |
| Social Feed | Medium (6) | Medium (5) | 22 | 🟢 Low |
| In-App Replay | Medium (7) | Large (8) | 20 | 🟢 Low |
| Referral Program | Low (5) | Medium (5) | 15 | 🟢 Low |
| Sponsor Integration | Low (4) | Large (8) | 8 | 🟢 Low |

**Score = Impact × (10 - Effort)** — Higher effort = lower score

---

## Contact & Ownership

- **Product Lead:** [To be assigned]
- **Tech Lead:** [To be assigned]
- **QA Lead:** [To be assigned]
- **Marketing Lead:** [To be assigned]

For questions about this roadmap, contact the Product Lead.

