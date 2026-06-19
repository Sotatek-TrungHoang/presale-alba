/**
 * API Configuration
 *
 * This file centralizes API configuration settings like
 * base URLs, timeouts, and authentication headers.
 */

// API Base URL from environment variables with fallback
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || "";

// Default request configuration
export const DEFAULT_CONFIG = {
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
  timeout: 10000, // 10 seconds
};

// Environment-specific settings
export const IS_DEVELOPMENT = process.env.NODE_ENV === "development";

// Flag to control whether to use mock data or real API
export const USE_MOCK_DATA = false; // Set to false to use real API

export const API_KEY = process.env.EXPO_PUBLIC_API_KEY;

/**
 * Helper function to build a full API URL
 */
export const buildApiUrl = (endpoint: string): string => {
  // Remove any leading slash from the endpoint
  const cleanEndpoint = endpoint.startsWith("/")
    ? endpoint.substring(1)
    : endpoint;
  // Remove any trailing slash from the base URL
  const cleanBaseUrl = API_BASE_URL.endsWith("/")
    ? API_BASE_URL.slice(0, -1)
    : API_BASE_URL;

  return `${cleanBaseUrl}/${cleanEndpoint}`;
};

export default {
  API_BASE_URL,
  DEFAULT_CONFIG,
  IS_DEVELOPMENT,
  USE_MOCK_DATA,
  API_KEY,
  buildApiUrl,
};
