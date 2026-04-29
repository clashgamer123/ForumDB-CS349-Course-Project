import { useEffect, useState } from "react";
import "../styles/MediaViewer.css";

const API_ROOT = "http://localhost:5000";

export function mediaSrc(mediaUrl) {
  if (!mediaUrl) return "/default-profile.svg";
  if (mediaUrl.startsWith("/uploads/")) return `${API_ROOT}${mediaUrl}`;
  return mediaUrl;
}

export default function MediaViewer({ media = [], compact = false }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    setCurrentIndex(0);
    setExpanded(false);
  }, [media]);

  if (!media.length) return null;

  const current = media[currentIndex];
  const next = () => setCurrentIndex((prev) => (prev + 1) % media.length);
  const prev = () => setCurrentIndex((prev) => (prev === 0 ? media.length - 1 : prev - 1));
  const isImage = current.media_type?.startsWith("image");

  const mediaNode = (
    isImage ? (
      <img src={mediaSrc(current.media_url)} alt={current.caption || ""} />
    ) : (
      <video controls>
        <source src={mediaSrc(current.media_url)} />
      </video>
    )
  );

  return (
    <>
      <div className={`media-viewer ${compact ? "compact" : ""}`}>
        <button
          type="button"
          className="media-open-button"
          onClick={() => setExpanded(true)}
          aria-label="Open media full screen"
        >
          <div className="media-frame">{mediaNode}</div>
        </button>

        {media.length > 1 && (
          <button type="button" className="media-nav left" onClick={prev} aria-label="Previous media">
            {"<"}
          </button>
        )}
        {media.length > 1 && (
          <button type="button" className="media-nav right" onClick={next} aria-label="Next media">
            {">"}
          </button>
        )}
        <div className="media-counter">{currentIndex + 1}/{media.length}</div>
      </div>

      {expanded && (
        <div className="media-lightbox" role="dialog" aria-modal="true">
          <button
            type="button"
            className="media-lightbox-close"
            onClick={() => setExpanded(false)}
            aria-label="Close media"
          >
            x
          </button>
          <div className="media-lightbox-body">
            {mediaNode}
          </div>
        </div>
      )}
    </>
  );
}
