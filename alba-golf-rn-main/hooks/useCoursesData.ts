import { useState, useCallback } from "react";
import {
  GolfCourse,
  getNearbyCourses,
  searchCoursesAndLocations,
  Location,
} from "@/api/courses";

export type SearchResults = {
  courses: GolfCourse[];
  locations: Location[];
};

interface UseCoursesDataProps {
  currentLocation?: { latitude: number; longitude: number } | null;
  selectedLocation?: { latitude: number; longitude: number } | null;
  searchTerm: string;
}

export function useCoursesData({
  currentLocation,
  selectedLocation,
  searchTerm,
}: UseCoursesDataProps) {
  const [closestCourses, setClosestCourses] = useState<GolfCourse[]>([]);
  const [locationCourses, setLocationCourses] = useState<GolfCourse[]>([]);
  const [searchResults, setSearchResults] = useState<SearchResults | null>(
    null
  );
  const [isLoadingClosest, setIsLoadingClosest] = useState(false);
  const [isLoadingLocationCourses, setIsLoadingLocationCourses] =
    useState(false);
  const [isLoadingSearch, setIsLoadingSearch] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch closest courses (by user location)
  const fetchClosestCourses = useCallback(async () => {
    if (!currentLocation) return;
    setIsLoadingClosest(true);
    setError(null);
    try {
      const courses = await getNearbyCourses(
        currentLocation.latitude,
        currentLocation.longitude
      );
      setClosestCourses(courses);
    } catch (err: any) {
      console.error("Error fetching closest courses:", err);
      setError(err.message || "Failed to fetch closest courses");
    } finally {
      setIsLoadingClosest(false);
    }
  }, [currentLocation]);

  // Fetch courses by selected location
  const fetchCoursesByLocation = useCallback(async () => {
    if (!selectedLocation) return;
    setIsLoadingLocationCourses(true);
    setError(null);
    try {
      const courses = await getNearbyCourses(
        selectedLocation.latitude,
        selectedLocation.longitude
      );
      setLocationCourses(courses);
    } catch (err: any) {
      console.error("Error fetching courses by location:", err);
      setError(err.message || "Failed to fetch courses by location");
    } finally {
      setIsLoadingLocationCourses(false);
    }
  }, [selectedLocation]);

  // Fetch search results (courses + locations)
  const fetchSearchResults = useCallback(async () => {
    if (!searchTerm) return;
    setIsLoadingSearch(true);
    setError(null);
    try {
      const data = await searchCoursesAndLocations(searchTerm);
      setSearchResults({
        courses: data.courses,
        locations: (data.locations || []).map((loc: any) => ({
          latitude: loc.latitude ?? loc.coordinates?.[1],
          longitude: loc.longitude ?? loc.coordinates?.[0],
          name: loc.name ?? loc.description ?? "",
          description: loc.description ?? loc.name ?? "",
        })),
      });
    } catch (err: any) {
      console.error("Error fetching search results:", err);
      setError(err.message || "Failed to fetch search results");
    } finally {
      setIsLoadingSearch(false);
    }
  }, [searchTerm]);

  return {
    closestCourses,
    locationCourses,
    searchResults,
    isLoadingClosest,
    isLoadingLocationCourses,
    isLoadingSearch,
    error,
    fetchClosestCourses,
    fetchCoursesByLocation,
    fetchSearchResults,
  };
}
