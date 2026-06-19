import React, {
  createContext,
  useState,
  useEffect,
  useContext,
  useCallback,
  ReactNode,
  useRef,
} from "react";
import * as Location from "expo-location";
import { AppState, AppStateStatus, Platform } from "react-native";
import { updateUserLocation } from "@/api/user";
import { useAuth } from "@/providers/Auth";
import { useProfileStore } from "@/stores/profileStore";

interface LocationContextType {
  currentLocation: Location.LocationObjectCoords | null;
  isLoadingLocation: boolean;
  locationError: string | null;
  requestLocationPermission: () => Promise<boolean>;
  fetchLocation: () => Promise<void>;
  isLocationAvailable: boolean; // True if we have a location, false if error or not yet fetched
}

const LocationContext = createContext<LocationContextType | undefined>(
  undefined
);

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({
  children,
}) => {
  const [currentLocation, setCurrentLocation] =
    useState<Location.LocationObjectCoords | null>(null);
  const [isLoadingLocation, setIsLoadingLocation] = useState(true);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [permissionStatus, setPermissionStatus] =
    useState<Location.PermissionStatus | null>(null);
  const { user } = useAuth();
  const { profile, loadingProfile } = useProfileStore();

  const requestLocationPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermissionStatus(status);
      if (status !== "granted") {
        setLocationError(
          "Location permission denied. Please enable it in settings."
        );
        setIsLoadingLocation(false);
        setCurrentLocation(null); // Clear any old location
        return false;
      }
      return true;
    } catch (err) {
      console.error("Error requesting location permission:", err);
      setLocationError("Failed to request location permission.");
      setIsLoadingLocation(false);
      setCurrentLocation(null);
      return false;
    }
  }, []);

  const fetchLocation = useCallback(async () => {
    if (permissionStatus !== "granted") {
      const granted = await requestLocationPermission();
      if (!granted) return; // Don't proceed if permission still not granted
    }

    setIsLoadingLocation(true);
    setLocationError(null);
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced, // Adjust accuracy as needed
      });
      setCurrentLocation(location.coords);
      setLocationError(null); // Clear previous errors
    } catch (err: any) {
      console.error("Error getting current location:", err);
      setLocationError(
        "Failed to get current location. " + (err.message || "")
      );
      // Don't clear currentLocation here, might want to keep the last known good one
    } finally {
      setIsLoadingLocation(false);
    }
  }, [permissionStatus, requestLocationPermission]);

  // Initial permission request and location fetch
  useEffect(() => {
    requestLocationPermission().then((granted) => {
      if (granted) {
        fetchLocation();
        // Add log to match foreground event
        console.log("App has come to the foreground, refreshing location.");
      }
    });
  }, [requestLocationPermission, fetchLocation]);

  // Refs for latest values
  const permissionStatusRef = useRef(permissionStatus);
  const fetchLocationRef = useRef(fetchLocation);
  const requestLocationPermissionRef = useRef(requestLocationPermission);

  useEffect(() => {
    permissionStatusRef.current = permissionStatus;
    fetchLocationRef.current = fetchLocation;
    requestLocationPermissionRef.current = requestLocationPermission;
  }, [permissionStatus, fetchLocation, requestLocationPermission]);

  // Handle app state changes to refresh location
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        console.log("App has come to the foreground, refreshing location.");
        if (permissionStatusRef.current === "granted") {
          fetchLocationRef.current();
        } else {
          requestLocationPermissionRef.current().then((granted) => {
            if (granted) fetchLocationRef.current();
          });
        }
      }
    };
    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => {
      subscription.remove();
    };
  }, []); // Only run once on mount/unmount

  // --- New effect: Sync location to backend after login ---
  useEffect(() => {
    if (user && profile && !loadingProfile && currentLocation) {
      updateUserLocation(
        currentLocation.latitude,
        currentLocation.longitude
      ).catch((err) => {
        console.error("Failed to update user location on backend:", err);
      });
    }
  }, [user, profile, loadingProfile, currentLocation]);

  const isLocationAvailable =
    !!currentLocation && !locationError && !isLoadingLocation;

  return (
    <LocationContext.Provider
      value={{
        currentLocation,
        isLoadingLocation,
        locationError,
        requestLocationPermission,
        fetchLocation,
        isLocationAvailable,
      }}
    >
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = (): LocationContextType => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error("useLocation must be used within a LocationProvider");
  }
  return context;
};
