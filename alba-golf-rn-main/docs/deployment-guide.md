# Deployment Guide

Comprehensive guide for building, testing, and releasing the Alba mobile app to iOS App Store and Google Play Store.

---

## Overview

Alba uses **EAS Build** (Expo Application Services) for CI/CD and **EAS Update** for over-the-air (OTA) JavaScript updates.

**Build Workflow:**
```
Local Development
    ↓
Git Commit & Push
    ↓
EAS Build (native compilation)
    ↓
App Store / Google Play Store
    ↓
EAS Update (optional: push JS-only fixes without store review)
```

---

## Prerequisites

### Local Setup

1. **Expo CLI**: `npm install -g expo-cli`
2. **EAS CLI**: `npm install -g eas-cli`
3. **Node.js**: ≥ 18
4. **Xcode** (macOS): For iOS builds
5. **Android Studio** (optional): For Android emulator
6. **Git**: For version control

### Expo Account

1. Create account at [expo.dev](https://expo.dev)
2. Login locally: `expo login` (or use `eas login`)
3. Verify project ownership in EAS (linked to Expo project ID in `app.config.js`)

### Credentials & Secrets

Required environment variables for builds:

| Variable | Source | Used For |
|----------|--------|----------|
| `EXPO_PUBLIC_API_URL` | Backend | REST API base URL |
| `EXPO_PUBLIC_FIREBASE_*` | Firebase Console | Auth & services |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | Payment setup |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN` | Mapbox Dashboard | Maps |
| `MAPBOX_DOWNLOADS_TOKEN` | Mapbox Dashboard | Native map build |
| `SENTRY_ORG` | Sentry Project | Error tracking |
| `SENTRY_PROJECT` | Sentry Project | Error tracking |

**Setup:**
1. Create `.env.production` file locally (never commit)
2. Add all EXPO_PUBLIC_* variables
3. EAS reads these during build

---

## Build Profiles

Configured in `eas.json`. Each profile has specific settings:

### Development Profile

**Use case:** Local testing on device or CI testing

```json
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal"
    }
  }
}
```

**Build:**
```bash
eas build --profile development
```

**Behavior:**
- Builds development client (allows hot reload)
- Internal distribution (not submitted to stores)
- Faster build (no code signing required)
- Must use `expo-dev-client` for live reload

### Development-TF Profile

**Use case:** QA testing on devices (test flight style)

```json
{
  "build": {
    "development-tf": {
      "distribution": "store",
      "environment": "development",
      "channel": "development",
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

**Build:**
```bash
eas build --profile development-tf --platform ios,android
```

**Behavior:**
- Distribution to TestFlight (iOS) / Google Play internal testing (Android)
- Auto-increments build number
- Release build configuration
- Requires valid signing certificates

### Preview Profile

**Use case:** Staging testing before production

```json
{
  "build": {
    "preview": {
      "distribution": "store",
      "environment": "preview",
      "channel": "preview",
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

**Build:**
```bash
eas build --profile preview --platform ios,android
```

**Behavior:**
- Distributed to TestFlight (iOS)
- Distributed to Google Play internal/alpha testing (Android)
- Preview channel for OTA updates
- Full release build

### Production Profile

**Use case:** Release to app stores (public users)

```json
{
  "build": {
    "production": {
      "distribution": "store",
      "environment": "production",
      "channel": "production",
      "autoIncrement": true,
      "ios": {
        "buildConfiguration": "Release"
      }
    }
  }
}
```

**Build:**
```bash
eas build --profile production --platform ios,android
```

**Submit:**
```bash
eas submit --profile production
```

**Behavior:**
- Full production build
- Submitted to App Store & Google Play Store
- Production channel for OTA updates
- Requires all credentials and signing certs

---

## Build Process

### Step 1: Pre-Build Checks

Before triggering any build:

```bash
# 1. Verify git is clean
git status
# Should show "nothing to commit, working tree clean"

# 2. Run full test suite
npm test

# 3. Run linting
npm run lint

# 4. Check TypeScript
npx tsc --noEmit
```

### Step 2: Update Version Numbers

Update `package.json` and `app.config.js`:

```json
// package.json
{
  "version": "1.2.0"
}
```

```javascript
// app.config.js
export default {
  version: "1.2.0",
  runtimeVersion: "1.2.0",
  ...
}
```

**Semantic Versioning:**
- **MAJOR:** Breaking changes (API breaking, incompatible)
- **MINOR:** New features (backward compatible)
- **PATCH:** Bug fixes

### Step 3: Create Git Tag

```bash
git tag v1.2.0
git push origin v1.2.0
```

### Step 4: Trigger EAS Build

```bash
# Build for both iOS & Android (takes ~30-45 min total)
eas build --profile production --platform ios,android

# Or single platform
eas build --profile production --platform ios
eas build --profile production --platform android
```

**Monitor build:**
```bash
# Check build status
eas build:list

# Watch build output in real-time
eas build:view [BUILD_ID]
```

### Step 5: Verify Build Artifacts

Once build completes:
- Download IPA (iOS) or APK (Android) from EAS dashboard
- Test on physical device (if possible)
- Check for warnings/errors in build logs

### Step 6: Submit to Stores

#### iOS App Store

```bash
eas submit --profile production --platform ios
```

**Requirements:**
- Valid Apple Developer account
- App signed with distribution certificate
- Proper provisioning profiles
- Privacy policy URL
- App review information

**Timeline:** 1–5 business days for review

#### Google Play Store

```bash
eas submit --profile production --platform android
```

**Requirements:**
- Google Play Developer account ($25 one-time fee)
- Service account key JSON (for automated submission)
- App signed with release key
- Privacy policy URL
- Content rating questionnaire

**Timeline:** Usually 2–4 hours for review (auto)

---

## Over-The-Air (OTA) Updates

EAS Update allows pushing JavaScript changes without app store review.

### When to Use OTA

✅ **Good for:**
- Bug fixes in JavaScript code
- UI/layout fixes
- Feature toggles / configuration changes
- Analytics/tracking updates

❌ **Not allowed:**
- Native code changes (requires new build)
- Permission changes
- Dependency updates (may require native rebuild)
- Major feature additions (better to go through store)

### Publishing an OTA Update

**Step 1: Make changes to JavaScript**

```bash
# Update code, test locally
npm test
npm run lint
```

**Step 2: Publish update**

```bash
# Publish to production channel
eas update --channel production --message "Fix game card rendering bug"

# Or preview channel for testing
eas update --channel preview --message "Test new payment flow"
```

**Step 3: Monitor rollout**

The update deploys to:
1. **10% of users** (first 1 hour) — Safe rollout
2. **50% of users** (next hour) — If no errors
3. **100% of users** (after 2 hours) — Full deployment

Check for errors via:
- Sentry error reports
- App analytics
- User feedback

---

## Debugging & Troubleshooting

### Build Failures

**Error: "Missing credentials"**
- Ensure all EXPO_PUBLIC_* env vars are set
- Check `eas.json` has correct environment keys
- Run `eas build:view [BUILD_ID]` for detailed logs

**Error: "Provisioning profile invalid"**
- iOS only: Update provisioning profiles in Apple Developer account
- Regenerate via `eas device:create` if needed
- Verify app ID matches bundle identifier in `app.config.js`

**Error: "Code signing failed"**
- Ensure Xcode command line tools installed: `xcode-select --install`
- Verify Apple credentials: `eas credentials`
- May need to revoke and regenerate certificates

### Runtime Issues

**App crashes on launch:**
1. Check Sentry error dashboard
2. Review build logs for native warnings
3. Test on development build: `eas build --profile development`

**OTA update not delivered:**
1. Verify app has internet connectivity
2. Check EAS Update status: `eas update:list`
3. Clear app cache on device
4. Force update check in code (if available)

### Device-Specific Issues

**iOS:**
- Minimum version: iOS 13+
- Test on actual device, not just simulator
- Check Xcode build errors in EAS logs

**Android:**
- Minimum version: Android 7 (API 24)
- Test on both physical device and emulator
- Check gradle build errors in EAS logs

---

## Monitoring & Analytics

### Sentry Integration

All crashes logged to Sentry:

```javascript
// app.config.js
[
  "@sentry/react-native/expo",
  {
    organization: process.env.SENTRY_ORG,
    project: process.env.SENTRY_PROJECT,
    url: "https://sentry.io/"
  }
]
```

**Monitor:**
1. Go to [sentry.io](https://sentry.io)
2. View recent issues, stack traces
3. Set up alerts for critical errors

### App Store Metrics

**iOS (App Store Connect):**
- Crashes & exceptions
- Hangs
- Disk writes
- App terminations

**Android (Google Play Console):**
- Crashes & ANRs
- Vitals (stability, performance)
- ANR rate (background processes hanging)

### Version Tracking

**Check app version deployed:**
```bash
# List recent builds
eas build:list --limit 10

# List recent updates
eas update:list --limit 10
```

---

## Release Checklist

Before every production release:

### Pre-Release (1 week before)
- [ ] Create release branch: `git checkout -b release/v1.2.0`
- [ ] Update version in `package.json` and `app.config.js`
- [ ] Run full test suite: `npm test`
- [ ] Run linting: `npm run lint`
- [ ] Update CHANGELOG with new features/fixes
- [ ] Create PR for release branch
- [ ] Get code review approval

### Build Phase (2–3 days before)
- [ ] Merge release PR to main
- [ ] Create git tag: `git tag v1.2.0`
- [ ] Trigger EAS build: `eas build --profile production --platform ios,android`
- [ ] Monitor build progress (check every hour)
- [ ] Once builds complete, download & test artifacts
- [ ] Verify no new crashes in Sentry

### Submit Phase (1 day before target release)
- [ ] Submit to App Store: `eas submit --profile production --platform ios`
- [ ] Submit to Google Play: `eas submit --profile production --platform android`
- [ ] Document submission details (build numbers, dates)
- [ ] Monitor for submission errors

### Release Phase (on target date)
- [ ] Check App Store review status (via App Store Connect)
- [ ] Check Google Play review status (via Play Console)
- [ ] Once approved, release to users
- [ ] Monitor error rates closely for 24 hours
- [ ] Be ready to publish a hot-fix OTA update if needed

### Post-Release (1 week after)
- [ ] Verify no spike in crashes (check Sentry)
- [ ] Check user feedback & ratings
- [ ] Document any issues found
- [ ] Plan for next release

---

## Environment Management

### Development Environment

```bash
# .env.development (not committed)
EXPO_PUBLIC_API_URL=https://dev-api.golfalba.co
EXPO_PUBLIC_FIREBASE_API_KEY=dev_key_xxx
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=alba-dev.firebaseapp.com
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_xxx
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN=pk.test_xxx
MAPBOX_DOWNLOADS_TOKEN=sk.xxx
```

### Production Environment

```bash
# Set in EAS secrets (not in repo)
eas secret:create --scope project EXPO_PUBLIC_API_URL https://api.golfalba.co
eas secret:create --scope project EXPO_PUBLIC_FIREBASE_API_KEY prod_key_xxx
# ... and so on for all secrets
```

**View secrets:**
```bash
eas secret:list
```

---

## Rollback Procedures

### If Production Build is Broken

**Option 1: Rollback via OTA Update**

```bash
# Publish previous version (if only JS was broken)
eas update --channel production --branch rollback-v1.1.9
```

**Option 2: Rollback via App Store**

```bash
# Immediate: Pause distribution
# Then: Submit hotfix build with bug fix
eas build --profile production
eas submit --profile production
```

### If OTA Update Breaks App

```bash
# EAS tracks update versions, can roll back via dashboard
# Or publish new update with fixes
eas update --channel production --message "Hotfix: revert broken payment modal"
```

---

## Performance Optimization

### Bundle Size Optimization

```bash
# Analyze bundle size
# (Requires metro bundler analysis plugin)
npm run build:analyze
```

**Typical sizes:**
- JS Bundle: 2–3 MB (gzipped)
- Native binary (iOS): 100–150 MB
- Native binary (Android): 80–120 MB

**Optimization tips:**
- Lazy-load large components
- Code-split by route (expo-router helps)
- Use dynamic imports for heavy libraries
- Monitor via Sentry performance

### App Load Time

**Targets:**
- Cold start: < 3s
- Hot start: < 1s
- Screen transition: < 500ms

**Monitor via:**
- Sentry performance
- App Store Vitals (iOS)
- Google Play Console (Android)

---

## Useful Commands

### Build Management

```bash
# List all builds
eas build:list

# View specific build details
eas build:view [BUILD_ID]

# Cancel build
eas build:cancel [BUILD_ID]

# Rebuild (retry failed build)
eas build:retry [BUILD_ID]
```

### Update Management

```bash
# List all updates
eas update:list

# View specific update
eas update:view [UPDATE_ID]

# View rollout status
eas update:view [UPDATE_ID] --show-rollout
```

### Local Testing

```bash
# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android

# Run on physical device (via Expo Go app)
npm start
# Then scan QR code with Expo Go on phone
```

### Debugging

```bash
# View app logs
eas build:view [BUILD_ID] --logs

# Check credentials
eas credentials --platform ios
eas credentials --platform android

# Create device (for beta testing)
eas device:create
```

---

## References

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [EAS Update Documentation](https://docs.expo.dev/eas-update/introduction/)
- [Expo SDK Documentation](https://docs.expo.dev/)
- [App Store Connect Help](https://help.apple.com/app-store-connect/)
- [Google Play Console Help](https://support.google.com/googleplay/android-developer/)
- [Sentry Setup](https://docs.sentry.io/platforms/react-native/)

---

## Contact & Support

- **EAS Issues:** [Expo GitHub Issues](https://github.com/expo/expo/issues)
- **Build Failures:** Check EAS build logs, contact Expo support
- **App Store Issues:** Apple App Store review guidelines
- **Google Play Issues:** Google Play policy center

