import { useState, useEffect } from "react";
import { getUserProfile, UserProfileWithStatsDto } from "@/api/user";
import { checkIfFollowing } from "@/api/follow";

// Helper function to calculate distance between two coordinates
const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371; // Radius of the Earth in kilometers
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return distance;
};

interface UseUserProfileOptions {
  id: string;
  currentLocation?: { latitude: number; longitude: number } | null;
  currentUserId?: string;
}

export function useUserProfile({
  id,
  currentLocation,
  currentUserId,
}: UseUserProfileOptions) {
  const [user, setUser] = useState<UserProfileWithStatsDto | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [distance, setDistance] = useState<number | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchUser = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const userData = await getUserProfile(id);
        setUser(userData);

        // Calculate distance if both current location and user location are available
        if (
          currentLocation &&
          userData.profile?.latitude &&
          userData.profile?.longitude
        ) {
          const calculatedDistance = calculateDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            userData.profile.latitude,
            userData.profile.longitude
          );
          setDistance(calculatedDistance);
        } else {
          setDistance(null);
        }

        // Check if current user is following this user (only if not viewing own profile)
        if (currentUserId && currentUserId !== id) {
          try {
            const followStatus = await checkIfFollowing(id);
            setIsFollowing(followStatus);
          } catch (followError) {
            // Optionally handle follow status error
          }
        } else {
          setIsFollowing(false);
        }
      } catch (err: any) {
        setError(err);
        setUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    fetchUser();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, currentLocation, currentUserId]);

  return {
    user,
    isLoading,
    distance,
    isFollowing,
    setIsFollowing,
    setUser,
    error,
  };
}
