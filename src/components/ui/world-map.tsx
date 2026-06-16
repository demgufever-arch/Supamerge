import { useMemo } from "react";
import DottedMap from "dotted-map";

import { useTheme } from "@/hooks/useTheme";

interface MapProps {
  dots?: Array<{
    start: { lat: number; lng: number; label?: string };
    end: { lat: number; lng: number; label?: string };
  }>;
  lineColor?: string;
}

const MAP_W = 800;
const MAP_H = 400;

function projectPoint(lat: number, lng: number) {
  return {
    x: (lng + 180) * (MAP_W / 360),
    y: (90 - lat) * (MAP_H / 180),
  };
}

function createCurvedPath(
  start: { x: number; y: number },
  end: { x: number; y: number }
) {
  const midX = (start.x + end.x) / 2;
  const dx = Math.abs(end.x - start.x);
  const midY = Math.min(start.y, end.y) - dx * 0.15 - 30;
  return `M ${start.x} ${start.y} Q ${midX} ${midY} ${end.x} ${end.y}`;
}

export default function WorldMap({
  dots = [],
  lineColor,
}: MapProps) {
  const { effective } = useTheme();
  const isDark = effective === "dark";
  
  // Use theme-aware emerald accent color if not provided
  const activeLineColor = lineColor || (isDark ? "#10b981" : "#059669");

  const backgroundSvg = useMemo(() => {
    const map = new DottedMap({ height: 200, grid: "diagonal" });
    return map.getSVG({
      radius: 0.4,
      color: isDark ? "#FFFFFF40" : "#00000025",
      shape: "circle",
      backgroundColor: "transparent",
    });
  }, [isDark]);

  const conns = useMemo(() => {
    return dots.map((dot) => {
      const start = projectPoint(dot.start.lat, dot.start.lng);
      const end = projectPoint(dot.end.lat, dot.end.lng);
      return { start, end, path: createCurvedPath(start, end) };
    });
  }, [dots]);

  return (
    <div className="w-full aspect-[2/1] rounded-lg relative font-sans overflow-hidden" style={{ backgroundColor: isDark ? 'var(--color-canvas)' : 'var(--color-surface)' }}>
      <svg viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="w-full h-full">
        <defs>
          <linearGradient id="path-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor={activeLineColor} stopOpacity="0" />
            <stop offset="10%" stopColor={activeLineColor} stopOpacity="1" />
            <stop offset="90%" stopColor={activeLineColor} stopOpacity="1" />
            <stop offset="100%" stopColor={activeLineColor} stopOpacity="0" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <style>{`
            @keyframes draw-path {
              to { stroke-dashoffset: 0; }
            }
            @keyframes pulse-ring {
              0% { opacity: 0.4; r: var(--r); }
              100% { opacity: 0; r: calc(var(--r) * 3); }
            }
          `}</style>
        </defs>

        {/* Background dots */}
        <svg viewBox="0 0 396 200" width={MAP_W} height={MAP_H}
          dangerouslySetInnerHTML={{
          __html: backgroundSvg
            .replace(/<svg[^>]*>/, '')
            .replace('</svg>', '')
        }} />

        {/* Connection lines + dots */}
        {conns.map((c, i) => {
          const pathLen = 2000;
          const delay = i * 0.4;
          return (
            <g key={`conn-${i}`}>
              {/* Path with draw animation */}
              <path
                d={c.path}
                fill="none"
                stroke="url(#path-gradient)"
                strokeWidth="1.5"
                strokeDasharray={pathLen}
                strokeDashoffset={pathLen}
                style={{
                  animation: `draw-path 1.5s ease-out ${delay}s forwards`,
                }}
              />
              {/* Start dot */}
              <circle cx={c.start.x} cy={c.start.y} r="3" fill={lineColor} opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay}s`} fill="freeze" />
              </circle>
              <circle cx={c.start.x} cy={c.start.y} r="3" fill={lineColor} opacity="0">
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin={`${delay + 0.5}s`} repeatCount="indefinite" />
                <animate attributeName="r" from="3" to="10" dur="2s" begin={`${delay + 0.5}s`} repeatCount="indefinite" />
              </circle>
              {/* End dot */}
              <circle cx={c.end.x} cy={c.end.y} r="4" fill={lineColor} opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay + 0.2}s`} fill="freeze" />
              </circle>
              <circle cx={c.end.x} cy={c.end.y} r="4" fill={lineColor} opacity="0">
                <animate attributeName="opacity" from="0.4" to="0" dur="2s" begin={`${delay + 0.7}s`} repeatCount="indefinite" />
                <animate attributeName="r" from="4" to="12" dur="2s" begin={`${delay + 0.7}s`} repeatCount="indefinite" />
              </circle>
              <circle cx={c.end.x} cy={c.end.y} r="1.5" fill={isDark ? "#020617" : "#f8fafc"} opacity="0">
                <animate attributeName="opacity" from="0" to="1" dur="0.3s" begin={`${delay + 0.4}s`} fill="freeze" />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
