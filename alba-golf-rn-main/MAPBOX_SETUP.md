# Mapbox Setup Guide

This project uses Mapbox for displaying golf courses on an interactive map with clustering for better performance.

## Setup Instructions

### 1. Get a Mapbox Access Token

1. Go to [Mapbox](https://www.mapbox.com/) and create an account
2. Navigate to your account dashboard
3. Create a new access token or use the default public token
4. Copy the access token

### 2. Configure the Access Token

1. Open the `.env` file in your project root
2. Replace `YOUR_MAPBOX_ACCESS_TOKEN_HERE` with your actual Mapbox access token:

```env
EXPO_PUBLIC_MAPBOX_ACCESS_TOKEN="pk.your_actual_token_here"
```

### 3. Update app.json (if needed)

The Mapbox plugin is already configured in `app.json`. If you need to update the download token for iOS/Android builds, you can add it to the plugin configuration:

```json
{
  "plugins": [
    [
      "@rnmapbox/maps",
      {
        "RNMapboxMapsDownloadToken": "your_download_token_here"
      }
    ]
  ]
}
```

### 4. Features Implemented

- **Interactive Map**: Displays golf courses on a Mapbox map
- **Clustering**: Groups nearby courses together for better performance
- **Location Services**: Automatically centers on user location when permission is granted
- **Course Markers**: Individual markers for each golf course with golf emoji
- **Callouts**: Tap markers to see course details (name, address, distance)
- **Responsive Design**: Works on both iOS and Android

### 5. API Integration

The map integrates with your existing golf course API:

- Fetches nearby courses using `getNearbyCourses()`
- Displays course information from the `GolfCourse` type
- Handles both `location` object and direct `lat`/`lng` properties

### 6. Performance Optimizations

- **Clustering**: Automatically groups nearby markers when zoomed out
- **Lazy Loading**: Only renders markers for visible courses
- **Efficient Rendering**: Uses Mapbox's optimized rendering engine

### 7. Troubleshooting

If you see a warning about missing Mapbox access token:

1. Make sure you've added the token to your `.env` file
2. Restart your development server
3. Clear your app cache if testing on device

### 8. Customization

You can customize the map by modifying:

- `initialLatitude`, `initialLongitude`, `initialZoom` props
- Marker styles in the `styles` object
- Clustering radius and behavior
- Map style (Street, Satellite, etc.)

## Usage

The map is automatically integrated into the Courses page. Users can:

- View all golf courses in their area
- Tap markers to see course details
- Use the location button to center on their current location
- Zoom and pan to explore different areas
