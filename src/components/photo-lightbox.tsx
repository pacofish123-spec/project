"use client";

import { useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

// Full-screen photo viewer with left/right navigation through a whole
// photo set — opened by clicking any photo (hero or thumbnail) on the
// vehicle detail page instead of each photo just opening its raw file
// in a new tab with no way to browse the rest from there.
export function PhotoLightbox({ photos, index, alt, onClose, onNavigate }: { photos: string[]; index: number; alt: string; onClose: () => void; onNavigate: (nextIndex: number) => void }) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") onNavigate((index - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight") onNavigate((index + 1) % photos.length);
    }
    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [index, photos.length, onClose, onNavigate]);

  return (
    <div className="photo-lightbox" role="dialog" aria-modal="true" aria-label={alt} onClick={onClose}>
      <button className="photo-lightbox-close" type="button" aria-label="Close" onClick={onClose}><X size={22} /></button>
      {photos.length > 1 && (
        <button className="photo-lightbox-nav prev" type="button" aria-label="Previous photo" onClick={(event) => { event.stopPropagation(); onNavigate((index - 1 + photos.length) % photos.length); }}>
          <ChevronLeft size={28} />
        </button>
      )}
      <img src={photos[index]} alt={`${alt} — photo ${index + 1} of ${photos.length}`} onClick={(event) => event.stopPropagation()} />
      {photos.length > 1 && (
        <button className="photo-lightbox-nav next" type="button" aria-label="Next photo" onClick={(event) => { event.stopPropagation(); onNavigate((index + 1) % photos.length); }}>
          <ChevronRight size={28} />
        </button>
      )}
      {photos.length > 1 && <span className="photo-lightbox-counter">{index + 1} / {photos.length}</span>}
    </div>
  );
}
