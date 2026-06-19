import React, { createContext, useContext, useEffect, useState } from "react";
import { GolfCourse, getAllCoursesForMap } from "@/api/courses";

interface CoursesContextType {
  allCourses: GolfCourse[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

const CoursesContext = createContext<CoursesContextType | undefined>(undefined);

export const useCourses = () => {
  const context = useContext(CoursesContext);
  if (context === undefined) {
    throw new Error("useCourses must be used within a CoursesProvider");
  }
  return context;
};

interface CoursesProviderProps {
  children: React.ReactNode;
}

export const CoursesProvider: React.FC<CoursesProviderProps> = ({
  children,
}) => {
  const [allCourses, setAllCourses] = useState<GolfCourse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAllCourses = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const courses = await getAllCoursesForMap();
      setAllCourses(courses);
    } catch (err) {
      console.error("Error loading all courses:", err);
      setError(err instanceof Error ? err.message : "Failed to load courses");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAllCourses();
  }, []);

  const refetch = async () => {
    await fetchAllCourses();
  };

  const value: CoursesContextType = {
    allCourses,
    isLoading,
    error,
    refetch,
  };

  return (
    <CoursesContext.Provider value={value}>{children}</CoursesContext.Provider>
  );
};
