const facebookAppId = process.env.EXPO_PUBLIC_FACEBOOK_APP_ID ?? "27422359920777607";
const facebookClientToken = process.env.EXPO_PUBLIC_FACEBOOK_CLIENT_TOKEN ?? "160d51adc0a621e8873feb50ac875ad4";
const redditSkAdNetworkIds = (process.env.EXPO_PUBLIC_REDDIT_SKADNETWORK_IDS ?? "6926b8e2-850e-4590-93bd-fbee6f67dabd")
  .split(",")
  .map((id) => id.trim())
  .filter(Boolean);

export default {
  name: "Alba",
  slug: "alba",
  version: "1.1.1",
  orientation: "portrait",
  icon: "./assets/images/alba-icon.png",
  scheme: "alba",
  userInterfaceStyle: "automatic",
  newArchEnabled: true,
  updates: {
    url: "https://u.expo.dev/98d855d4-43ae-4808-8abc-cef08fcb9e4b",
  },
  runtimeVersion: "1.1.1",
  ios: {
    icon: "./assets/images/alba-icon.png",
    supportsTablet: false,
    bundleIdentifier: "com.davros.alba",
    usesAppleSignIn: true,
    associatedDomains: ["applinks:app.golfalba.co"],
    infoPlist: {
      ITSAppUsesNonExemptEncryption: false,
      NSLocationWhenInUseUsageDescription: "This app needs access to your location to show you the courses and games near you.",
      NSCameraUsageDescription: "This app needs access to your camera to let you take a profile picture.",
      NSPhotoLibraryUsageDescription: "This app needs access to your photo library to let you upload a profile picture.",
      ...(redditSkAdNetworkIds.length
        ? {
            SKAdNetworkItems: redditSkAdNetworkIds.map((identifier) => ({
              SKAdNetworkIdentifier: identifier,
            })),
          }
        : {}),
    },
  },
  android: {
    icon: "./assets/images/alba-icon.png",
    package: "com.davros.alba",
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? "./google-services.json",
    intentFilters: [
      {
        action: "VIEW",
        autoVerify: true,
        data: [
          {
            scheme: "https",
            host: "app.golfalba.co",
            pathPrefix: "/round"
          }
        ],
        category: ["BROWSABLE", "DEFAULT"]
      }
    ]
  },
  web: {
    bundler: "metro",
    output: "static",
    favicon: "./assets/images/favicon.png"
  },
  plugins: [
    "expo-router",
    [
      "expo-splash-screen",
      {
        image: "./assets/images/alba-transparent.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#000000"
      }
    ],
    "expo-web-browser",
    [
      "@rnmapbox/maps",
      {
        RNMapboxMapsDownloadToken: process.env.MAPBOX_DOWNLOADS_TOKEN ?? ""
      }
    ],
    "expo-notifications",
    "@react-native-community/datetimepicker",
    [
      "@stripe/stripe-react-native",
      {
        merchantIdentifier: "merchant.com.davros.alba"
      }
    ],
    [
      "@react-native-google-signin/google-signin",
      {
        iosUrlScheme: process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME ?? "com.googleusercontent.apps.613832455558-6c9rp275tnblkbrgblastj762h9aid69"
      }
    ],
    "expo-apple-authentication",
    "expo-font",
    [
      "@sentry/react-native/expo",
      {
        organization: process.env.SENTRY_ORG,
        project: process.env.SENTRY_PROJECT,
        url: "https://sentry.io/"
      }
    ],
    [
      "react-native-fbsdk-next",
      {
        appID: facebookAppId,
        clientToken: facebookClientToken,
        displayName: "Alba",
        scheme: `fb${facebookAppId}`,
        advertiserIDCollectionEnabled: true,
        autoLogAppEventsEnabled: true,
        isAutoInitEnabled: true,
        iosUserTrackingPermission:
          "Alba uses your activity to measure ad performance and deliver a more relevant experience."
      }
    ],
    [
      "expo-tracking-transparency",
      {
        userTrackingPermission:
          "Alba uses your activity to measure ad performance and deliver a more relevant experience."
      }
    ]
  ],
  experiments: {
    typedRoutes: true
  },
  extra: {
    router: {},
    eas: {
      projectId: "98d855d4-43ae-4808-8abc-cef08fcb9e4b"
    }
  },
  owner: "alba-golf"
}; 