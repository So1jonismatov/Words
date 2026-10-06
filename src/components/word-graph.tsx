"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  select,
  zoom as d3zoom,
  zoomIdentity,
  type Simulation,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
  type ZoomBehavior,
  type ZoomTransform,
} from "d3";
import { cn } from "@/lib/utils";

export type NodeKind = "hub" | "cue" | "answer";

export interface GraphNode {
  id: string;
  label: string;
  kind: NodeKind;
  /** Drives the radius: people who answered (cue) or gave the answer. */
  weight: number;
  /** Cue the participant played / answer the participant gave. */
  highlight?: boolean;
}

export interface GraphEdge {
  source: string;
  target: string;
  /** "answer" = cue → answer, "related" = dictionary relation, "q1" = concept → first word. */
  kind: "answer" | "related" | "q1";
  weight: number;
  highlight?: boolean;
}

type SimNode = GraphNode & SimulationNodeDatum & { r: number };
type SimEdge = Omit<GraphEdge, "source" | "target"> & SimulationLinkDatum<SimNode>;

/** Layout is computed almost to rest before the first paint (a few ms), so it opens settled and framed. */
const PRE_TICKS = 300;

/**
 * Obsidian-style association graph. d3-force lays it out (pre-ticked so it opens
 * settled), d3-zoom pans/zooms, React renders the SVG so colours follow the theme
 * tokens. Hover or select a node to dim everything outside its neighbourhood; drag
 * nodes to rearrange. Cue nodes are focusable and selectable with Enter/Space.
 */
export function WordGraph({
  nodes,
  edges,
  selected,
  onSelect,
  labels,
  className,
}: {
  nodes: GraphNode[];
  edges: GraphEdge[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  labels: { zoomIn: string; zoomOut: string; fit: string; graph: string };
  className?: string;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const simRef = useRef<Simulation<SimNode, SimEdge> | null>(null);
  const zoomRef = useRef<ZoomBehavior<SVGSVGElement, unknown> | null>(null);
  const positions = useRef(new Map<string, { x: number; y: number }>());
  // 0×0 until measured: the layout and the first fit wait for the real container size.
  const [size, setSize] = useState({ w: 0, h: 0 });
  const measured = size.w > 0;
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const [, setFrame] = useState(0);
  const [hover, setHover] = useState<string | null>(null);
  const [simNodes, setSimNodes] = useState<SimNode[]>([]);
  const [simEdges, setSimEdges] = useState<SimEdge[]>([]);
  const dragging = useRef<{ id: string; moved: boolean; x0: number; y0: number } | null>(null);
  /** Set once the user pans/zooms, so the automatic fit never fights them. */
  const userMoved = useRef(false);
  const fitRef = useRef<(animate?: boolean, trim?: number) => void>(() => {});
  /** Container aspect ratio when the layout is built: the layout is stretched to match it. */
  const aspect = useRef(1.5);

  // Track the container size.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) {
        aspect.current = width / height;
        setSize({ w: width, h: height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // (Re)build the simulation when the data changes, keeping known positions.
  useEffect(() => {
    if (!measured) return;
    const maxW = { hub: 1, cue: 1, answer: 1 };
    for (const n of nodes) maxW[n.kind] = Math.max(maxW[n.kind], n.weight);
    const radius = (n: GraphNode) =>
      n.kind === "hub" ? 15 : n.kind === "cue" ? 6.5 + 7 * Math.sqrt(n.weight / maxW.cue) : 3.5 + 6 * Math.sqrt(n.weight / maxW.answer);

    const sn: SimNode[] = nodes.map((n) => {
      const p = positions.current.get(n.id);
      return { ...n, r: radius(n), x: p?.x, y: p?.y, fx: n.kind === "hub" ? 0 : undefined, fy: n.kind === "hub" ? 0 : undefined };
    });
    const byId = new Map(sn.map((n) => [n.id, n]));
    const se: SimEdge[] = edges
      .filter((e) => byId.has(e.source) && byId.has(e.target))
      .map((e) => ({ ...e, source: e.source, target: e.target }));
    const maxEdge = Math.max(1, ...se.filter((e) => e.kind === "answer").map((e) => e.weight));

    simRef.current?.stop();
    const sim = forceSimulation<SimNode, SimEdge>(sn)
      .force(
        "link",
        forceLink<SimNode, SimEdge>(se)
          .id((d) => d.id)
          .distance((e) => (e.kind === "related" ? 130 : e.kind === "q1" ? 80 : 42 + 40 * (1 - e.weight / maxEdge)))
          .strength((e) => (e.kind === "related" ? 0.04 : e.kind === "q1" ? 0.2 : 0.5)),
      )
      .force("charge", forceManyBody<SimNode>().strength((d) => (d.kind === "answer" ? (d.weight > 1 ? -70 : -35) : d.kind === "hub" ? -500 : -280)))
      // Cue labels are always visible, so their collision radius allows for the text.
      .force("collide", forceCollide<SimNode>().radius((d) => (d.kind === "answer" ? d.r + 3 : d.r + 6 + Math.min(40, d.label.length * 3))))
      // Pull harder along the short side so the layout fills a wide (or tall) box.
      .force("x", forceX<SimNode>(0).strength(0.012 * Math.max(1, 1 / aspect.current) ** 1.5))
      .force("y", forceY<SimNode>(0).strength(0.012 * Math.max(1, aspect.current) ** 1.5))
      .stop();
    const fresh = sn.some((n) => n.x === undefined);
    for (let i = 0; i < (fresh ? PRE_TICKS : 20); i++) sim.tick();

    let raf = 0;
    sim.on("tick", () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => setFrame((f) => f + 1));
      for (const n of sn) if (n.x !== undefined && n.y !== undefined) positions.current.set(n.id, { x: n.x, y: n.y });
    });
    // Once the layout settles, frame it (unless the user has moved the view).
    sim.on("end", () => {
      if (!userMoved.current) fitRef.current(true, 0.03);
    });
    sim.alpha(fresh ? 0.06 : 0.4).restart();
    simRef.current = sim;
    setSimNodes(sn);
    setSimEdges(se);
    return () => {
      sim.stop();
      cancelAnimationFrame(raf);
    };
  }, [nodes, edges, measured]);

  /**
   * Zoom to the nodes. `trim` ignores that share of outermost nodes on each side, so a
   * few leaf answers on the rim don't shrink the whole map (the fit button shows all).
   */
  const fit = useCallback(
    (animate = true, trim = 0) => {
      const svg = svgRef.current;
      const z = zoomRef.current;
      if (!svg || !z || simNodes.length === 0) return;
      const xs = simNodes.map((n) => n.x ?? 0).sort((a, b) => a - b);
      const ys = simNodes.map((n) => n.y ?? 0).sort((a, b) => a - b);
      const cut = Math.floor(simNodes.length * trim);
      const pad = 14;
      const x0 = xs[cut] - pad,
        x1 = xs[xs.length - 1 - cut] + pad,
        y0 = ys[cut] - pad,
        y1 = ys[ys.length - 1 - cut] + pad;
      const margin = 28;
      const k = Math.min(2.2, Math.max(0.3, Math.min((size.w - margin * 2) / (x1 - x0 || 1), (size.h - margin * 2) / (y1 - y0 || 1))));
      const t = zoomIdentity.translate(size.w / 2 - k * ((x0 + x1) / 2), size.h / 2 - k * ((y0 + y1) / 2)).scale(k);
      const sel = select(svg);
      if (animate) sel.transition().duration(450).call(z.transform, t);
      else sel.call(z.transform, t);
    },
    [simNodes, size],
  );
  fitRef.current = fit;

  // Pan/zoom on the background; nodes handle their own pointer events (drag/click).
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const z = d3zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 5])
      .filter((event: Event) => !(event.target as Element).closest?.("[data-node]") && !(event as MouseEvent).button)
      .on("zoom", (e) => {
        if (e.sourceEvent) userMoved.current = true;
        setTransform(e.transform);
      });
    zoomRef.current = z;
    select(svg).call(z).on("dblclick.zoom", null);
    return () => {
      select(svg).on(".zoom", null);
    };
  }, []);

  // Fit once after the first layout of a new data set.
  const fittedFor = useRef<GraphNode[] | null>(null);
  useEffect(() => {
    if (simNodes.length && measured && fittedFor.current !== nodes) {
      fittedFor.current = nodes;
      fit(false, 0.03);
    }
  }, [simNodes, nodes, fit, measured]);

  // Selecting the concept (the default) shouldn't fade the whole map; other selections focus their neighbourhood.
  const active = hover ?? (nodes.find((n) => n.id === selected)?.kind === "hub" ? null : selected);
  const neighbours = useMemo(() => {
    if (!active) return null;
    const set = new Set([active]);
    for (const e of simEdges) {
      const s = (e.source as SimNode).id;
      const t = (e.target as SimNode).id;
      if (s === active) set.add(t);
      if (t === active) set.add(s);
    }
    return set;
  }, [active, simEdges]);

  const maxEdge = Math.max(1, ...simEdges.filter((e) => e.kind === "answer").map((e) => e.weight));
  const answerWeights = simNodes.filter((n) => n.kind === "answer").map((n) => n.weight).sort((a, b) => b - a);
  const labelCut = answerWeights[Math.min(answerWeights.length - 1, 14)] ?? Infinity;

  const toGraph = (clientX: number, clientY: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return transform.invert([clientX - rect.left, clientY - rect.top]);
  };

  const onPointerDown = (n: SimNode) => (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    dragging.current = { id: n.id, moved: false, x0: e.clientX, y0: e.clientY };
  };
  const onPointerMove = (n: SimNode) => (e: React.PointerEvent) => {
    const d = dragging.current;
    if (!d || d.id !== n.id) return;
    if (!d.moved && Math.hypot(e.clientX - d.x0, e.clientY - d.y0) < 4) return;
    if (!d.moved) {
      d.moved = true;
      simRef.current?.alphaTarget(0.25).restart();
    }
    const [x, y] = toGraph(e.clientX, e.clientY);
    n.fx = x;
    n.fy = y;
  };
  const onPointerUp = (n: SimNode) => () => {
    const d = dragging.current;
    dragging.current = null;
    if (!d) return;
    if (d.moved) {
      simRef.current?.alphaTarget(0);
      if (n.kind !== "hub") {
        n.fx = null;
        n.fy = null;
      }
    } else onSelect(selected === n.id ? null : n.id);
  };

  const zoomBy = (k: number) => {
    const svg = svgRef.current;
    if (svg && zoomRef.current) select(svg).transition().duration(250).call(zoomRef.current.scaleBy, k);
  };

  return (
    <div ref={wrapRef} className={cn("relative min-h-0 overflow-hidden rounded-3xl bg-card-3", className)}>
      <svg
        ref={svgRef}
        width={size.w}
        height={size.h}
        role="img"
        aria-label={labels.graph}
        className="block cursor-grab touch-none select-none active:cursor-grabbing"
        onClick={(e) => {
          if (e.target === e.currentTarget) onSelect(null);
        }}
      >
        <g transform={transform.toString()}>
          <g>
            {simEdges.map((e, i) => {
              const s = e.source as SimNode;
              const t = e.target as SimNode;
              const dim = neighbours && !(neighbours.has(s.id) && neighbours.has(t.id));
              const on = neighbours && !dim;
              return (
                <line
                  key={i}
                  x1={s.x}
                  y1={s.y}
                  x2={t.x}
                  y2={t.y}
                  stroke={e.kind === "related" ? "var(--accent)" : e.highlight ? "var(--accent)" : "var(--muted)"}
                  strokeOpacity={dim ? 0.06 : on ? 0.85 : e.kind === "related" ? 0.35 : 0.22 + 0.4 * (e.weight / maxEdge)}
                  strokeWidth={(e.kind === "answer" ? 0.7 + 2.3 * (e.weight / maxEdge) : 1) / Math.sqrt(transform.k)}
                  strokeDasharray={e.kind === "related" ? "4 4" : undefined}
                />
              );
            })}
          </g>
          {simNodes.map((n) => {
            const dim = neighbours && !neighbours.has(n.id);
            const isActive = n.id === active;
            const showLabel =
              n.kind !== "answer" || isActive || n.highlight || (neighbours?.has(n.id) ?? false) || transform.k >= 1.5 || n.weight >= labelCut;
            const focusable = n.kind !== "answer";
            return (
              <g
                key={n.id}
                data-node
                transform={`translate(${n.x ?? 0},${n.y ?? 0})`}
                opacity={dim ? 0.18 : 1}
                className="cursor-pointer outline-none [&:focus-visible>circle:first-child]:stroke-(--ring)"
                tabIndex={focusable ? 0 : undefined}
                role={focusable ? "button" : undefined}
                aria-label={focusable ? n.label : undefined}
                aria-pressed={focusable ? selected === n.id : undefined}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onSelect(selected === n.id ? null : n.id);
                  }
                }}
                onPointerEnter={() => setHover(n.id)}
                onPointerLeave={() => setHover((h) => (h === n.id ? null : h))}
                onFocus={() => setHover(n.id)}
                onBlur={() => setHover((h) => (h === n.id ? null : h))}
                onPointerDown={onPointerDown(n)}
                onPointerMove={onPointerMove(n)}
                onPointerUp={onPointerUp(n)}
              >
                {/* Generous invisible hit area for touch. */}
                <circle r={Math.max(n.r + 6, 12 / transform.k)} fill="transparent" stroke="transparent" strokeWidth={3} />
                <circle
                  r={n.r}
                  fill={
                    n.kind === "hub"
                      ? "var(--fg)"
                      : n.kind === "cue"
                        ? n.highlight
                          ? "var(--accent)"
                          : "color-mix(in oklab, var(--accent) 45%, var(--card-3))"
                        : n.highlight
                          ? "var(--accent-soft)"
                          : "var(--teal)"
                  }
                  stroke={selected === n.id ? "var(--fg)" : n.kind === "answer" && n.highlight ? "var(--accent)" : "var(--card-3)"}
                  strokeWidth={selected === n.id ? 2.5 : n.kind === "answer" && n.highlight ? 2 : 1.5}
                />
                {showLabel && (
                  <text
                    y={n.r + (n.kind === "answer" ? 10 : 13)}
                    textAnchor="middle"
                    lang="uz"
                    fontSize={(n.kind === "hub" ? 15 : n.kind === "cue" ? 12.5 : 11) / Math.sqrt(Math.max(transform.k, 0.6))}
                    fontWeight={n.kind === "answer" && !n.highlight ? 500 : 700}
                    fill={n.kind === "answer" ? "var(--fg)" : "var(--fg)"}
                    fillOpacity={n.kind === "answer" && !n.highlight && !isActive ? 0.78 : 1}
                    paintOrder="stroke"
                    stroke="var(--card-3)"
                    strokeWidth={3}
                    strokeLinejoin="round"
                    className="pointer-events-none"
                  >
                    {n.label}
                  </text>
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="absolute right-2 bottom-2 flex flex-col gap-1">
        {[
          { label: labels.zoomIn, onClick: () => zoomBy(1.4), icon: "M10 4v12M4 10h12" },
          { label: labels.zoomOut, onClick: () => zoomBy(1 / 1.4), icon: "M4 10h12" },
          { label: labels.fit, onClick: () => fit(), icon: "M4 8V4h4M16 8V4h-4M4 12v4h4M16 12v4h-4" },
        ].map((b) => (
          <button
            key={b.label}
            type="button"
            aria-label={b.label}
            title={b.label}
            onClick={b.onClick}
            className="tap flex size-9 items-center justify-center rounded-full bg-card text-muted shadow-sm transition-colors hover:text-fg"
          >
            <svg viewBox="0 0 20 20" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d={b.icon} />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}
