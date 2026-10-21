"use client";
import { useEffect, useRef } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
export type MapPoint = { latitude: number; longitude: number };
export function IssueMap({
  value,
  onChange,
  points = [],
}: {
  value?: MapPoint | null;
  onChange?: (p: MapPoint) => void;
  points?: (MapPoint & { id: string; title: string; status: string })[];
}) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const marker = useRef<Marker | null>(null);
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  }, [onChange]);
  useEffect(() => {
    let active = true;
    void import("leaflet").then((L) => {
      if (!active || !container.current) return;
      const icon = L.divIcon({
        className: "",
        html: '<span style="display:block;width:20px;height:20px;background:#0284c7;border:3px solid white;border-radius:50%;box-shadow:0 1px 6px #0008"></span>',
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      const instance = L.map(container.current).setView(
        [value?.latitude ?? 20.59, value?.longitude ?? 78.96],
        value ? 14 : 5,
      );
      map.current = instance;
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution:
          '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(instance);
      if (onChange) {
        marker.current = L.marker(
          [value?.latitude ?? 20.59, value?.longitude ?? 78.96],
          { icon, draggable: true },
        ).addTo(instance);
        marker.current.on("dragend", () => {
          const p = marker.current!.getLatLng();
          callback.current?.({ latitude: p.lat, longitude: p.lng });
        });
        instance.on("click", (e) => {
          marker.current?.setLatLng(e.latlng);
          callback.current?.({
            latitude: e.latlng.lat,
            longitude: e.latlng.lng,
          });
        });
      }
      points.forEach((p) => {
        const label = document.createElement("span");
        label.textContent = `${p.title} · ${p.status.replaceAll("_", " ")}`;
        L.marker([p.latitude, p.longitude], { icon })
          .addTo(instance)
          .bindPopup(label);
      });
    });
    return () => {
      active = false;
      map.current?.remove();
      map.current = null;
    };
    // Recreate only when the public result set changes. Selection is synchronized below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points]);
  useEffect(() => {
    if (value && map.current) {
      marker.current?.setLatLng([value.latitude, value.longitude]);
      map.current.setView(
        [value.latitude, value.longitude],
        Math.max(14, map.current.getZoom()),
      );
    }
  }, [value]);
  return (
    <div
      ref={container}
      className="h-72 w-full rounded-xl border z-0"
      role="region"
      aria-label={
        onChange
          ? "Issue location map. Click or drag the marker; coordinate inputs are also available."
          : "Public incident map with approximate locations"
      }
    />
  );
}
