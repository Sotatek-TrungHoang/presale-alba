import React, { useEffect, useState } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  Alert,
  Text,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import { GolfCourse } from "../api/courses";
import { colors } from "@/constants/theme";
import { typography, spacing } from "@/constants/theme";
import { useCourses } from "@/providers/CoursesProvider";

// Set Mapbox access token from environment variable
const MAPBOX_ACCESS_TOKEN = process.env.EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN;
if (MAPBOX_ACCESS_TOKEN) {
  Mapbox.setAccessToken(MAPBOX_ACCESS_TOKEN);
} else {
  console.warn(
    "Mapbox access token not found. Please set EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN in your .env file"
  );
}

const { width, height } = Dimensions.get("window");

interface CoursesMapProps {
  onCoursePress?: (course: GolfCourse) => void;
  initialLatitude?: number;
  initialLongitude?: number;
  initialZoom?: number;
}

export default function CoursesMap({
  onCoursePress,
  initialLatitude = 40.7128,
  initialLongitude = -74.006,
  initialZoom = 10,
}: CoursesMapProps) {
  const { allCourses, isLoading, error } = useCourses();

  // Show loading state while courses are being fetched
  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" color={colors.text.primary} />
        <Text style={styles.loadingText}>Loading courses...</Text>
      </View>
    );
  }

  // Show error state if courses failed to load
  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Oops! The map failed to load</Text>
        <Text style={styles.errorSubtext}>Don't worry, you can still search for courses above</Text>
      </View>
    );
  }

  // Show empty state if no courses
  if (!allCourses || allCourses.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>No courses found</Text>
      </View>
    );
  }

  const onMarkerPress = (event: any) => {

    // Handle clustering layer events
    if (event.features && event.features.length > 0) {
      const feature = event.features[0];
      const courseId = feature.properties?.courseId;

      if (courseId) {
        const course = allCourses.find((c) => c.id === courseId);
        if (course && onCoursePress) {
          onCoursePress(course);
        }
      }
    } else if (event.id) {
      // Handle PointAnnotation events (fallback)
      const courseId = event.id;
      const course = allCourses.find((c) => c.id === courseId);
      if (course && onCoursePress) {
        onCoursePress(course);
      }
    }
  };

  const renderCourseMarkers = () => {
    console.log("Rendering markers for courses:", allCourses.length);
    return allCourses.map((course) => {
      const coordinates = course.location
        ? [course.location.longitude, course.location.latitude]
        : course.lng && course.lat
        ? [course.lng, course.lat]
        : null;

      if (!coordinates) {
        console.log("No coordinates for course:", course.name);
        return null;
      }

      console.log(
        "Rendering marker for course:",
        course.name,
        "at",
        coordinates
      );

      return (
        <Mapbox.PointAnnotation
          key={course.id}
          id={course.id}
          coordinate={coordinates}
          onSelected={onMarkerPress}
          title={course.name}
        >
          <View style={styles.marker}>
            <Text style={styles.markerText}>🏌️</Text>
          </View>
        </Mapbox.PointAnnotation>
      );
    });
  };

  return (
    <View style={styles.container}>
      <Mapbox.MapView style={styles.map} styleURL={Mapbox.StyleURL.Street}>
        <Mapbox.Camera
          defaultSettings={{
            centerCoordinate: [initialLongitude, initialLatitude],
            zoomLevel: initialZoom,
          }}
        />

        {/* Add clustering layer for better performance */}
        <Mapbox.ShapeSource
          id="coursesSource"
          shape={{
            type: "FeatureCollection",
            features: allCourses
              .filter((course) => {
                const coords = course.location
                  ? [course.location.longitude, course.location.latitude]
                  : course.lng && course.lat
                  ? [course.lng, course.lat]
                  : null;
                return coords !== null;
              })
              .map((course) => ({
                type: "Feature",
                geometry: {
                  type: "Point",
                  coordinates: course.location
                    ? [course.location.longitude, course.location.latitude]
                    : [course.lng!, course.lat!],
                },
                properties: {
                  courseId: course.id,
                  name: course.name,
                  address: course.address,
                  distance: course.distance,
                },
              })),
          }}
          cluster
          clusterRadius={50}
          onPress={onMarkerPress}
        >
          <Mapbox.CircleLayer
            id="clusteredPoints"
            filter={["has", "point_count"]}
            style={{
              circleColor: "#E23642",
              circleRadius: [
                "step",
                ["get", "point_count"],
                20,
                100,
                30,
                750,
                40,
              ],
              circleOpacity: 0.8,
              circleStrokeWidth: 2,
              circleStrokeColor: "#fff",
            }}
          />

          <Mapbox.SymbolLayer
            id="clusterCount"
            filter={["has", "point_count"]}
            style={{
              textField: ["get", "point_count"],
              textSize: 12,
              textColor: "#fff",
            }}
          />

          <Mapbox.CircleLayer
            id="unclusteredPoint"
            filter={["!", ["has", "point_count"]]}
            style={{
              circleColor: "#E23642",
              circleRadius: 8,
              circleStrokeWidth: 2,
              circleStrokeColor: "#fff",
            }}
          />
        </Mapbox.ShapeSource>
      </Mapbox.MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: colors.neutral.black,
  },
  loadingText: {
    fontSize: typography.fontSizes.md,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  errorText: {
    fontSize: typography.fontSizes.lg,
    color: colors.text.primary,
    textAlign: "center",
  },
  errorSubtext: {
    fontSize: typography.fontSizes.sm,
    color: colors.text.secondary,
    textAlign: "center",
    marginTop: spacing.sm,
  },
  markerContainer: {
    alignItems: "center",
  },
  marker: {
    backgroundColor: "#11b4da",
    borderRadius: 20,
    padding: 8,
    borderWidth: 2,
    borderColor: "#fff",
  },
  markerText: {
    fontSize: 16,
  },
  calloutContainer: {
    padding: 8,
    minWidth: 150,
  },
  calloutTitle: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 4,
  },
  calloutAddress: {
    fontSize: 12,
    color: "#666",
    marginBottom: 2,
  },
  calloutDistance: {
    fontSize: 12,
    color: "#11b4da",
    fontWeight: "500",
  },
  locationButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    backgroundColor: "#fff",
    borderRadius: 25,
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  locationButtonText: {
    fontSize: 20,
  },
});
