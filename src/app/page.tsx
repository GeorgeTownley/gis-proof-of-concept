"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function Home() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const [postcode, setPostcode] = useState("");
  const [mapLoaded, setMapLoaded] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<{
    postcode: string;
    coordinates: [number, number] | null;
  }>({ postcode: "", coordinates: null });
  const [radius, setRadius] = useState(1000); // Default 1km radius in meters

  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    console.log("Initializing map...");

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-0.1276, 51.5074],
        zoom: 12,
        attributionControl: {},
      });

      map.current.on("load", () => {
        console.log("Map loaded successfully!");
        setMapLoaded(true);

        // Add source for the radius circle
        map.current?.addSource("radius-circle", {
          type: "geojson",
          data: {
            type: "FeatureCollection",
            features: [],
          },
        });

        // Add layer for the area outside the circle (greyscale overlay)
        map.current?.addLayer({
          id: "greyscale-overlay",
          type: "fill",
          source: "radius-circle",
          paint: {
            "fill-color": "#808080",
            "fill-opacity": 0.4,
          },
        });

        // Add layer for the circle outline
        map.current?.addLayer({
          id: "radius-outline",
          type: "line",
          source: "radius-circle",
          paint: {
            "line-color": "#3b82f6",
            "line-width": 2,
            "line-dasharray": [2, 2],
          },
        });
      });

      map.current.on("error", (e) => {
        console.error("Map error:", e);
      });

      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    } catch (error) {
      console.error("Failed to initialize map:", error);
    }

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Update the radius circle when location or radius changes
  useEffect(() => {
    if (selectedLocation.coordinates && map.current && mapLoaded) {
      updateRadiusCircle();
    }
  }, [selectedLocation.coordinates, radius, mapLoaded]);

  const createCirclePolygon = (
    center: [number, number],
    radiusInMeters: number,
    points: number = 64
  ) => {
    const coords = [];
    const earthRadius = 6371000; // Earth's radius in meters

    for (let i = 0; i < points; i++) {
      const angle = (i / points) * 2 * Math.PI;

      // Calculate offset in degrees
      const latOffset = (radiusInMeters / earthRadius) * (180 / Math.PI);
      const lngOffset =
        ((radiusInMeters / earthRadius) * (180 / Math.PI)) /
        Math.cos((center[1] * Math.PI) / 180);

      const lat = center[1] + latOffset * Math.cos(angle);
      const lng = center[0] + lngOffset * Math.sin(angle);

      coords.push([lng, lat]);
    }
    coords.push(coords[0]); // Close the polygon

    return coords;
  };

  const createInvertedPolygon = (
    center: [number, number],
    radiusInMeters: number
  ) => {
    const circleCoords = createCirclePolygon(center, radiusInMeters);

    // Create a large outer boundary (world extent)
    const worldBounds = [
      [-180, -85],
      [180, -85],
      [180, 85],
      [-180, 85],
      [-180, -85],
    ];

    return [worldBounds, circleCoords];
  };

  const updateRadiusCircle = () => {
    if (!selectedLocation.coordinates || !map.current) return;

    const invertedCoords = createInvertedPolygon(
      selectedLocation.coordinates,
      radius
    );
    const circleCoords = createCirclePolygon(
      selectedLocation.coordinates,
      radius
    );

    // Update the source with both the greyscale overlay and circle outline
    const source = map.current.getSource(
      "radius-circle"
    ) as maplibregl.GeoJSONSource;
    if (source) {
      source.setData({
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            properties: { type: "overlay" },
            geometry: {
              type: "Polygon",
              coordinates: invertedCoords,
            },
          },
          {
            type: "Feature",
            properties: { type: "circle" },
            geometry: {
              type: "Polygon",
              coordinates: [circleCoords],
            },
          },
        ],
      });

      // Update layer filters to show different features
      map.current.setFilter("greyscale-overlay", [
        "==",
        ["get", "type"],
        "overlay",
      ]);
      map.current.setFilter("radius-outline", [
        "==",
        ["get", "type"],
        "circle",
      ]);
    }
  };

  const geocodePostcode = async (postcode: string) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&country=GB&postalcode=${encodeURIComponent(
          postcode
        )}&limit=1`
      );
      const data = await response.json();

      if (data && data.length > 0) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        return [lng, lat] as [number, number];
      }
      return null;
    } catch (error) {
      console.error("Geocoding error:", error);
      return null;
    }
  };

  const handleLocationSearch = async () => {
    if (!postcode.trim() || !map.current) return;

    const coordinates = await geocodePostcode(postcode.trim());

    if (coordinates) {
      setSelectedLocation({ postcode: postcode.trim(), coordinates });

      map.current.flyTo({
        center: coordinates,
        zoom: 15,
        duration: 1000,
      });

      const existingMarker = document.querySelector(".location-marker");
      if (existingMarker) {
        existingMarker.remove();
      }

      new maplibregl.Marker({ color: "#ef4444", className: "location-marker" })
        .setLngLat(coordinates)
        .addTo(map.current);
    } else {
      alert("Postcode not found. Please try again.");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleLocationSearch();
    }
  };

  const formatRadius = (radiusInMeters: number) => {
    if (radiusInMeters >= 1000) {
      return `${(radiusInMeters / 1000).toFixed(1)}km`;
    }
    return `${radiusInMeters}m`;
  };

  return (
    <div className="flex h-screen">
      {/* Left Panel */}
      <div className="w-[350px] bg-white border-r border-gray-200 flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">
            Property Area Analysis
          </h1>
          <p className="text-sm text-gray-600">
            Enter a postcode to analyze the area
          </p>
        </div>

        {/* Location Search */}
        <div className="p-6 space-y-4">
          <div>
            <label
              htmlFor="postcode"
              className="block text-sm font-medium text-gray-700 mb-2"
            >
              Postcode
            </label>
            <div className="flex space-x-2">
              <input
                id="postcode"
                type="text"
                value={postcode}
                onChange={(e) => setPostcode(e.target.value.toUpperCase())}
                onKeyPress={handleKeyPress}
                placeholder="e.g. SW1A 1AA"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
              />
              <button
                onClick={handleLocationSearch}
                disabled={!postcode.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Search
              </button>
            </div>
          </div>

          {/* Radius Control */}
          {selectedLocation.coordinates && (
            <div className="space-y-4">
              <div>
                <label
                  htmlFor="radius"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Analysis Radius: {formatRadius(radius)}
                </label>
                <input
                  id="radius"
                  type="range"
                  min="100"
                  max="5000"
                  step="100"
                  value={radius}
                  onChange={(e) => setRadius(parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                />
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>100m</span>
                  <span>5km</span>
                </div>
              </div>
            </div>
          )}

          {/* Selected Location Info */}
          {selectedLocation.coordinates && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Selected Location
              </h3>
              <div className="text-sm text-gray-600 space-y-1">
                <div>Postcode: {selectedLocation.postcode}</div>
                <div>
                  Coordinates: {selectedLocation.coordinates[1].toFixed(4)},{" "}
                  {selectedLocation.coordinates[0].toFixed(4)}
                </div>
                <div>Radius: {formatRadius(radius)}</div>
              </div>
            </div>
          )}
        </div>

        {/* Placeholder for future controls */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="text-sm text-gray-500">
            {selectedLocation.coordinates
              ? "Analysis controls will appear here. Adjust the radius above to focus on different area sizes."
              : "Analysis controls will appear here once a location is selected."}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative h-screen">
        <div ref={mapContainer} className="absolute inset-0 w-full h-full" />

        {/* Map overlay info */}
        <div className="absolute top-4 left-4 bg-white bg-opacity-90 backdrop-blur-sm px-3 py-2 rounded-lg shadow-sm">
          <div className="text-sm text-gray-700">
            {mapLoaded
              ? "Click and drag to explore • Search postcode to analyze"
              : "Loading map..."}
          </div>
          {!mapLoaded && (
            <div className="text-xs text-gray-500 mt-1">
              Map status: Initializing...
            </div>
          )}
          {selectedLocation.coordinates && (
            <div className="text-xs text-blue-600 mt-1">
              Analysis area: {formatRadius(radius)} radius
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
        }

        .slider::-moz-range-thumb {
          height: 20px;
          width: 20px;
          border-radius: 50%;
          background: #3b82f6;
          cursor: pointer;
          border: none;
        }
      `}</style>
    </div>
  );
}
