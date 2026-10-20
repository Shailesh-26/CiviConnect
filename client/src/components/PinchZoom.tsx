import { useEffect } from "react";
import { useMap } from "react-leaflet";

// Laptop touchpads send a pinch as a wheel event with Ctrl held. On maps where scroll-to-zoom is off
// (so scrolling the page past a map never gets stuck), that pinch used to zoom the whole page.
// This catches it and zooms the map around the fingers instead; plain two-finger scrolling still scrolls the page.
export function PinchZoom() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    let pending = 0;
    let frame = 0;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      pending += e.deltaY;
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const steps = Math.trunc(pending / 30);
        if (!steps) return;
        pending -= steps * 30;
        const point = map.mouseEventToContainerPoint(e);
        const zoom = Math.min(map.getMaxZoom(), Math.max(map.getMinZoom(), map.getZoom() - Math.sign(steps)));
        map.setZoomAround(point, zoom);
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      el.removeEventListener("wheel", onWheel);
      cancelAnimationFrame(frame);
    };
  }, [map]);
  return null;
}
