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

          {/* Selected Location Info */}
          {selectedLocation.coordinates && (
            <div className="mt-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-900 mb-2">
                Selected Location
              </h3>
              <div className="text-sm text-gray-600">
                <div>Postcode: {selectedLocation.postcode}</div>
                <div>
                  Coordinates: {selectedLocation.coordinates[1].toFixed(4)},{" "}
                  {selectedLocation.coordinates[0].toFixed(4)}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Placeholder for future controls */}
        <div className="flex-1 p-6 bg-gray-50">
          <div className="text-sm text-gray-500">
            Analysis controls will appear here once a location is selected.
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
        </div>
      </div>
    </div>
  );
}
