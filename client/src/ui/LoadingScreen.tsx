import React from 'react';

export function LoadingScreen() {
  return (
    <div style={styles.overlay}>
      <style>{keyframes}</style>

      {/* Decorative background polygons */}
      <div style={{ ...styles.poly, ...styles.polyTL }} />
      <div style={{ ...styles.poly, ...styles.polyBR }} />
      <div style={{ ...styles.poly, ...styles.polyMid }} />

      <div style={styles.content}>
        {/* CSS low-poly car on a road strip */}
        <div style={styles.scene}>
          <div style={styles.road}>
            <div style={styles.roadLine} />
          </div>
          <div style={styles.carWrap}>
            {/* Car body */}
            <div style={styles.carBody}>
              {/* Cabin */}
              <div style={styles.cabin} />
              {/* Windows */}
              <div style={styles.windowL} />
              <div style={styles.windowR} />
            </div>
            {/* Wheels */}
            <div style={{ ...styles.wheel, ...styles.wheelFront }} />
            <div style={{ ...styles.wheel, ...styles.wheelBack }} />
          </div>
        </div>

        {/* Title + subtitle */}
        <p style={styles.title}>Warming up the engines…</p>
        <p style={styles.sub}>Loading world assets</p>

        {/* Dot progress row */}
        <div style={styles.dots}>
          <span style={{ ...styles.dot, animationDelay: '0s' }} />
          <span style={{ ...styles.dot, animationDelay: '0.18s' }} />
          <span style={{ ...styles.dot, animationDelay: '0.36s' }} />
        </div>
      </div>
    </div>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────────── */

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'linear-gradient(160deg, #d6f0ff 0%, #bfe9ff 35%, #3aa0ff 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    fontFamily: "'Nunito', 'Varela Round', 'Comic Sans MS', cursive",
  },

  /* Background decorative triangles (CSS clip-path polygons) */
  poly: {
    position: 'absolute',
    pointerEvents: 'none',
    opacity: 0.18,
  },
  polyTL: {
    top: -60,
    left: -60,
    width: 260,
    height: 260,
    background: '#fff',
    clipPath: 'polygon(0 0, 100% 0, 0 100%)',
  },
  polyBR: {
    bottom: -80,
    right: -80,
    width: 320,
    height: 320,
    background: '#1b6fa8',
    clipPath: 'polygon(100% 0, 100% 100%, 0 100%)',
  },
  polyMid: {
    top: '20%',
    right: '8%',
    width: 120,
    height: 120,
    background: '#fff3d6',
    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
    animation: 'zoomies-float 3.2s ease-in-out infinite',
  },

  /* ── Scene ── */
  content: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 0,
    zIndex: 1,
  },
  scene: {
    position: 'relative',
    width: 220,
    height: 80,
    marginBottom: 28,
  },
  road: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 22,
    background: '#3a3f4a',
    borderRadius: 4,
    overflow: 'hidden',
  },
  roadLine: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    height: 4,
    width: '100%',
    background: 'repeating-linear-gradient(90deg, #fff3d6 0px, #fff3d6 24px, transparent 24px, transparent 44px)',
    animation: 'zoomies-road 0.55s linear infinite',
  },

  /* ── Car ── */
  carWrap: {
    position: 'absolute',
    bottom: 14,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 88,
    animation: 'zoomies-bounce 0.55s ease-in-out infinite',
  },
  carBody: {
    position: 'relative',
    width: 88,
    height: 28,
    background: '#ff6b6b',  /* coral-red default; recolor via JS if needed */
    borderRadius: '6px 6px 4px 4px',
  },
  cabin: {
    position: 'absolute',
    top: -20,
    left: 14,
    width: 48,
    height: 22,
    background: '#ff8787',
    borderRadius: '8px 8px 0 0',
    clipPath: 'polygon(6% 100%, 0% 0%, 100% 0%, 94% 100%)',
  },
  windowL: {
    position: 'absolute',
    top: -17,
    left: 18,
    width: 18,
    height: 14,
    background: '#d6f5ff',
    borderRadius: 3,
    opacity: 0.85,
  },
  windowR: {
    position: 'absolute',
    top: -17,
    left: 40,
    width: 18,
    height: 14,
    background: '#d6f5ff',
    borderRadius: 3,
    opacity: 0.85,
  },
  wheel: {
    position: 'absolute',
    bottom: -9,
    width: 18,
    height: 18,
    background: '#234',
    borderRadius: '50%',
    border: '3px solid #888',
    animation: 'zoomies-spin 0.55s linear infinite',
  },
  wheelFront: { right: 10 },
  wheelBack:  { left: 10  },

  /* ── Text ── */
  title: {
    margin: '0 0 6px',
    fontSize: 22,
    fontWeight: 800,
    color: '#1b3a5c',
    letterSpacing: '-0.3px',
    textShadow: '0 2px 0 rgba(255,255,255,0.55)',
  },
  sub: {
    margin: '0 0 18px',
    fontSize: 13,
    fontWeight: 600,
    color: '#2c5f8a',
    textTransform: 'uppercase',
    letterSpacing: '1.5px',
    opacity: 0.75,
  },

  /* ── Dots ── */
  dots: {
    display: 'flex',
    gap: 8,
  },
  dot: {
    display: 'inline-block',
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#fff',
    opacity: 0.9,
    animation: 'zoomies-pulse 0.72s ease-in-out infinite',
    boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
  },
};

/* ─── Keyframes ──────────────────────────────────────────────────────────── */

const keyframes = `
  @keyframes zoomies-bounce {
    0%, 100% { transform: translateX(-50%) translateY(0px); }
    50%       { transform: translateX(-50%) translateY(-5px); }
  }
  @keyframes zoomies-spin {
    to { transform: rotate(360deg); }
  }
  @keyframes zoomies-road {
    from { background-position: 0 0; }
    to   { background-position: -44px 0; }
  }
  @keyframes zoomies-pulse {
    0%, 100% { opacity: 0.25; transform: scale(0.8); }
    50%       { opacity: 1;    transform: scale(1.15); }
  }
  @keyframes zoomies-float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50%       { transform: translateY(-12px) rotate(6deg); }
  }
`;
