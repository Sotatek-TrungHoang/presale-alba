# Alba Social Backend - Project Overview & PDR

## Executive Summary

Alba is a golf social networking platform that enables golfers to connect, organize games, manage payments, and track scores. The backend provides REST APIs for mobile and web clients, real-time messaging via WebSockets, and payment processing through Stripe.

**Target Market:** Golfers seeking social play opportunities with like-minded players  
**Key Value Proposition:** Frictionless game organization + social discovery + fair payment handling

## Product Overview

### Core Features

#### 1. User Onboarding & Profiles
- Multi-step onboarding capturing golf preferences, handicap range, player type, availability
- Profile management with photos, location, contact details, handicap tracking
- Attribution tracking (marketing campaign source at signup)

#### 2. Game Management
- **Game Creation:** Organize games with player count, location, time slot, game type, format, cost
- **Game Discovery:** Recommendation engine suggesting games based on user preferences and location
- **Player Management:** Join requests, organizer approval, invite system
- **Game Status Workflow:** PLAYERS_REQUIRED → READY_TO_BOOK → READY → COMPLETED/CANCELLED
- **Payment Tracking:** Per-player payment status, amounts, Stripe integration

#### 3. Social Features
- Posts (general social posts and golf score posts)
- Follow/following relationships and leaderboards
- Groups with member management and group conversations
- Comments and likes on posts

#### 4. Real-Time Communication
- Direct messages between users
- Group conversations
- Game-specific chat channels
- Socket.IO WebSocket gateway for live messaging

#### 5. Payment Processing
- Stripe Connect integration for organizer payouts
- Payment holds for 2 days post-game (dispute resolution)
- Transaction tracking with comprehensive event logging
- Refund and payout management

#### 6. Course Management
- Golf course database with tee information, hole data, ratings/slopes
- Course reviews and condition reporting
- Course search and filtering
- Favorite course management

#### 7. Content Moderation
- User blocking functionality
- Report system for users, conversations, games
- Complaint tracking for game disputes (organizer no-show, cancellations)
- Admin complaint resolution

#### 8. Notifications
- Push notifications via Expo Server SDK
- Notification history and delivery tracking
- Notification preferences per user
- Real-time in-app notifications via WebSocket

---

## Product Development Requirements (PDR)

### Functional Requirements

#### Requirement Set 1: User Account & Authentication
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F1.1 | Firebase ID token authentication on all protected endpoints | MUST | IMPLEMENTED |
| F1.2 | User onboarding workflow (questions → preferences → profile) | MUST | IMPLEMENTED |
| F1.3 | Admin role with protected admin endpoints | MUST | IMPLEMENTED |
| F1.4 | User last_active_at tracking for activity status | SHOULD | IMPLEMENTED |

#### Requirement Set 2: Game Management
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F2.1 | Create games with venue, time, player capacity, costs | MUST | IMPLEMENTED |
| F2.2 | Game status state machine (PLAYERS_REQUIRED, READY_TO_BOOK, READY, COMPLETED, CANCELLED) | MUST | IMPLEMENTED |
| F2.3 | Player join/request workflow with organizer approval | MUST | IMPLEMENTED |
| F2.4 | Invite system for organizer to invite specific players | SHOULD | IMPLEMENTED |
| F2.5 | Game recommendation algorithm based on preferences/location | MUST | IMPLEMENTED |
| F2.6 | List games by status, location, date range | SHOULD | IMPLEMENTED |

#### Requirement Set 3: Payment & Stripe
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F3.1 | Stripe Connect account onboarding for organizers | MUST | IMPLEMENTED |
| F3.2 | Payment intent creation and checkout session handling | MUST | IMPLEMENTED |
| F3.3 | 2-day payment hold post-game for dispute resolution | MUST | IMPLEMENTED |
| F3.4 | Webhook handling for payment, payout, and account events | MUST | IMPLEMENTED |
| F3.5 | Transaction history with comprehensive Stripe object tracking | SHOULD | IMPLEMENTED |
| F3.6 | Refund processing for cancelled games or disputes | SHOULD | IMPLEMENTED |

#### Requirement Set 4: Social Features
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F4.1 | Create/edit/delete posts (general and score posts) | MUST | IMPLEMENTED |
| F4.2 | Like and comment on posts | SHOULD | IMPLEMENTED |
| F4.3 | Follow/unfollow users and view relationships | SHOULD | IMPLEMENTED |
| F4.4 | Leaderboard calculations (handicap, scores, participation) | SHOULD | IMPLEMENTED |
| F4.5 | Group creation with member invites and role-based access | SHOULD | IMPLEMENTED |

#### Requirement Set 5: Real-Time Communication
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F5.1 | Socket.IO WebSocket gateway for chat messages | MUST | IMPLEMENTED |
| F5.2 | Store messages and conversation history in database | MUST | IMPLEMENTED |
| F5.3 | Support direct, group, and game-specific conversations | SHOULD | IMPLEMENTED |
| F5.4 | Last-read timestamp for message tracking | SHOULD | IMPLEMENTED |

#### Requirement Set 6: Content Moderation
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F6.1 | Block users and enforce blocking in API queries | MUST | IMPLEMENTED |
| F6.2 | Report users, conversations, games with reason | SHOULD | IMPLEMENTED |
| F6.3 | Complaint system for game disputes (organizer no-show, etc.) | MUST | IMPLEMENTED |
| F6.4 | Admin complaint resolution and refund processing | SHOULD | IMPLEMENTED |

#### Requirement Set 7: Notifications
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F7.1 | Push notifications via Expo Server SDK | MUST | IMPLEMENTED |
| F7.2 | Notification history and read/unread tracking | SHOULD | IMPLEMENTED |
| F7.3 | Per-user notification preferences (game, chat, follow, general) | SHOULD | IMPLEMENTED |
| F7.4 | Scheduled notification runner (cron job) | SHOULD | IMPLEMENTED |

#### Requirement Set 8: Image Management
| ID | Requirement | Priority | Status |
|---|---|---|---|
| F8.1 | Image upload to AWS S3 | SHOULD | IMPLEMENTED |
| F8.2 | Presigned URL generation for client uploads | SHOULD | IMPLEMENTED |
| F8.3 | Image processing/optimization | SHOULD | IMPLEMENTED |

### Non-Functional Requirements

| ID | Category | Requirement | Target | Status |
|---|---|---|---|---|
| NF1 | Performance | API p99 latency <500ms | P99 <500ms | IMPLEMENTED |
| NF2 | Availability | Service uptime 99.5% | 99.5% SLA | MONITORED |
| NF3 | Security | All user data encrypted at rest | TLS 1.3+ | IMPLEMENTED |
| NF4 | Security | Stripe webhook signature verification | 100% verified | IMPLEMENTED |
| NF5 | Data Integrity | Soft deletes via deleted_at field | 100% compliance | IMPLEMENTED |
| NF6 | Monitoring | Sentry error tracking (5xx errors) | Real-time | IMPLEMENTED |
| NF7 | Testing | Unit test coverage | >60% | IN PROGRESS |
| NF8 | Database | PostgreSQL v14+ with indexes | Indexed queries | IMPLEMENTED |

### Acceptance Criteria

#### User Onboarding
- [ ] User completes all onboarding questions
- [ ] User preferences saved to UserOnboarding and UserAvailability models
- [ ] Attribution captured at signup (campaign source)
- [ ] Profile photo can be uploaded
- [ ] User can edit profile anytime

#### Game Management
- [ ] Game creators can post games with all required details
- [ ] Players can discover games via search/recommendation
- [ ] Players can request to join (goes to PENDING status)
- [ ] Organizers can approve/reject players
- [ ] Game status transitions correctly through workflow
- [ ] Game can be cancelled and players are refunded
- [ ] Game recommendations consider player preferences and location

#### Payments
- [ ] Organizers complete Stripe Connect onboarding
- [ ] Payment intents created for game participants
- [ ] Funds held for 2 days post-game
- [ ] Webhook events processed reliably
- [ ] Transaction history fully auditable
- [ ] Payouts transfer to organizer bank account

#### Messaging
- [ ] Messages deliver in real-time via WebSocket
- [ ] Message history persists in database
- [ ] Users see game-specific chat in game conversation
- [ ] Read receipts tracked via last_read timestamp

#### Moderation
- [ ] Blocked users cannot message the blocker
- [ ] Reported content visible to admins for review
- [ ] Complaints prevent payouts until resolved
- [ ] Admins can refund disputed game payments

---

## Technical Constraints & Dependencies

### External Services
- **Firebase Admin SDK:** Authentication (JWT validation)
- **Stripe API:** Payment processing, Connect account management
- **AWS S3:** Image storage and presigned URLs
- **Google Maps API:** Location services and course locations
- **Expo Server SDK:** Push notifications to iOS/Android
- **Mapbox:** Optional geocoding service
- **Anthropic Claude API:** Potential AI features (detected in package.json)

### Data Model Constraints
- All timestamps use ISO 8601 format
- Soft deletes via `deleted_at` field (no hard deletes in production)
- Database field names use snake_case
- IDs use UUID or CUID
- Stripe object IDs stored for audit trail

### API Constraints
- All endpoints protected by Firebase auth guard (except `/auth/*` and `/well-known/*`)
- Admin endpoints protected by admin guard
- Global ValidationPipe enforces DTO validation
- CORS enabled for web clients
- Swagger UI at `/api` for API exploration

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| User Onboarding Completion Rate | >80% | TBD |
| Game Posting Rate | >50 games/day (at scale) | TBD |
| Payment Success Rate | >98% | TBD |
| Player Retention (30-day) | >60% | TBD |
| Average Game Capacity Fill | >75% | TBD |
| Support Ticket Rate | <5% of payments | TBD |
| API Availability | 99.5% | MONITORING |

---

## Risk Mitigation

| Risk | Probability | Impact | Mitigation |
|------|-----------|--------|-----------|
| Stripe webhook delivery failure | Medium | High | Idempotent webhook handling, event log, retry mechanism |
| User payment disputes | Medium | High | 2-day hold period, complaint system, audit trail |
| Concurrent game state changes | Low | High | Database transactions, optimistic locking on GamePlayer status |
| Firebase auth service outage | Low | High | Graceful degradation, cached tokens (short window), fallback messaging |
| S3 upload failures | Low | Medium | Presigned URL retry, SQS queue for async processing |
| Real-time message loss | Low | High | Persistent message storage, acknowledgments, delivery status tracking |

---

## Known Limitations

1. **Image Processing:** Currently stored raw in S3; no automatic resizing/optimization
2. **Leaderboard Calculations:** May require periodic batch refresh for large player counts
3. **Payment Disputes:** Manual admin intervention required; no automated dispute resolution
4. **Notification Delivery:** Dependent on Expo SDK reliability; no guaranteed delivery SLA
5. **Geographic Search:** Limited by Google Maps API rate limits and costs

---

## Future Roadmap

- **Phase 1 (Current):** MVP with core features (auth, games, payments, messaging)
- **Phase 2:** Advanced leaderboards, league management, scoring precision
- **Phase 3:** Mobile app native push notifications, offline support
- **Phase 4:** AI-powered game matching, skill-based recommendations
- **Phase 5:** Marketplace for golf products/services, sponsorships
