# Alba – React Native Mobile App

Alba is a cross-platform social mobile application built with **React Native**, **Expo**, and **TypeScript**.  
The project targets **iOS**, **Android** from a single code-base and relies on a modern tool-chain including **expo-router**, **Firebase**, **Stripe**, **Mapbox**, and **Zustand** for state-management.

---

## Table of contents

1. [Prerequisites](#prerequisites)
2. [Quick start](#quick-start)
3. [Environment variables](#environment-variables)
4. [Available npm scripts](#available-scripts)
5. [Running the application](#running-the-application)
6. [Testing](#testing)
7. [Linting & formatting](#linting--formatting)
8. [Building & releasing](#building--releasing)
9. [Project structure](#project-structure)
10. [Additional documentation](#additional-documentation)

---

## Prerequisites

• **Node.js ≥ 18** and **npm ≥ 9** (or `pnpm` / `yarn` if you prefer).  
• **Expo CLI** – install globally with `npm i -g expo-cli`.  
• Xcode (macOS) and/or Android Studio **emulators** if you want to run the app on simulators locally.  
• An _Expo_ account for EAS build & OTA updates.

---

## Getting started

```bash
# 1. Clone the repository
$ git clone https://github.com/<your-org>/alba-react-native.git
$ cd alba-react-native

# 2. Install dependencies
$ npm install

# 3. Copy the example environment file and fill in the blanks
$ cp .env.example .env
# edit .env with your keys

# Run the application in ios mode
npx expo run:ios
# Note we now have `associatedDomains` which means device config requirements in
# XCode are more strict.  You either need to disable that or define the app can
# automatically manage signing

# 4. Start the development server (select a device in the Expo UI)
$ npm start
```

> ℹ️ The default command opens the **Expo Dev Tools** in your browser where you can launch the iOS simulator, Android emulator, or open the QR-code in **Expo Go**.

---

## Environment variables

Sensitive keys (Firebase, Stripe, API endpoints, Mapbox, etc.) are injected via the standard Expo **`process.env.EXPO_PUBLIC_*`** convention and accessed at runtime through `expo-constants`.

| Variable                             | Purpose                      |
| ------------------------------------ | ---------------------------- |
| `EXPO_PUBLIC_API_URL`                | REST backend base-URL        |
| `EXPO_PUBLIC_FIREBASE_API_KEY`       | Firebase Web API key         |
| `EXPO_PUBLIC_REDDIT_SKADNETWORK_IDS`  | Reddit SKAdNetwork IDs       |
| `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Stripe publishable key       |
| `EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN`    | Mapbox SDK token             |
| ...                                  | See `.env` for the full list |

**Do NOT commit production secrets**. Use separate values for `DEV`, `STAGING`, and `PROD` as shown in the template.

---

## Available scripts

Run with `npm run <script>`

| Script                    | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `start`                   | Launch the Expo dev server                       |
| `android` / `ios` / `web` | Shortcut to run on a specific platform           |
| `reset-project`           | Move starter code to `app-example` & start fresh |
| `test`                    | Jest in watch-mode                               |
| `test:coverage`           | Generate coverage report                         |
| `lint`                    | Run `expo lint` with the project’s ESLint config |

---

## Running the application

1. Make sure the **metro bundler** is running (`npm start`).
2. **Development build** – Full native APIs with hot-reload. Trigger from the dev-tools _“Run on device”_ menu.

Navigation is handled via **expo-router** and follows the file-based routing pattern inside the `app/` directory.

---

## Testing

Unit & integration tests are written with **Jest** and **@testing-library/react-native**.

```bash
# Run the full test-suite
npm test

# Watch specific folders (hooks, components, utils)
npm run test:hooks
```

Detailed guidelines live in [`TESTING.md`](TESTING.md).

---

## Linting & formatting

We rely on **ESLint** (via `expo lint`) and **Prettier**.  
Run `npm run lint` before committing or integrate it in your editor for on-save formatting.

---

## Building & releasing

We use **EAS Build** to generate App Store & Play Store binaries and **EAS Update** for OTA updates.

```bash
# Run the pre-build step
npx expo prebuild --clean --platform ios

# Build a development client (internal distribution)
expo eas build --profile development

# Build a production release
expo eas build --profile production --platform ios,android

# Submit to stores (requires credentials & service-accounts)
expo eas submit --profile production

# Do everything in a one-er
eas build --profile development-tf --platform ios --auto-submit
```

Profiles are defined in [`eas.json`](eas.json). Make sure you are logged in with `expo login` and have the correct permissions on the Expo project **ID**.

---

## Project structure

```
├── app/                   # File-based routed screens
├── components/            # Reusable UI components
├── hooks/                 # Custom hooks (business logic)
├── providers/             # React Context providers
├── api/                   # Remote API wrappers (Axios)
├── stores/                # Zustand stores (global state)
├── utils/                 # Pure util functions & helpers
├── constants/             # Design tokens & static configs
├── assets/                # Images, fonts, icons
└── tests/                 # Jest test suites & mocks
```

---

## Additional documentation

- [`NOTIFICATION_SETUP.md`](NOTIFICATION_SETUP.md) – Expo push notifications workflow.
- [`MAPBOX_SETUP.md`](MAPBOX_SETUP.md) – Configuring Mapbox for native builds.
- [`REFACTORING_SUMMARY.md`](REFACTORING_SUMMARY.md) – High-level overview of the last major refactor.
- [`NOTIFICATION_INTEGRATION.md`](NOTIFICATION_INTEGRATION.md) – Backend endpoints & flows.

---

## Contributing

1. Fork the repository and create your branch: `git checkout -b feature/my-feature`
2. Make your changes following the [Expo style guide](#) and run `npm test && npm run lint`.
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push to the branch: `git push origin feature/my-feature` and open a Pull Request.
