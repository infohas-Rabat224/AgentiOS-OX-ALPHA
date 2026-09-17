import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  Activity,
  Zap,
  Clock,
  Layers,
  TrendingUp,
  Sliders,
  Play,
  Pause,
  Filter,
  Check,
  ChevronDown,
  AlertTriangle,
  CheckCircle2,
  X,
  Gauge
} from 'lucide-react';
import { TimeSeriesPoint, omniRouterService } from '../../services/omniRouter';

export interface AgentLoadMeta {
  key: string;
  name: string;
  label: string;
  color: string;
  vendor: string;
}

export const AGENT_TRACK_ITEMS: AgentLoadMeta[] = [
  { key: 'claude', name: 'Claude 3.7 Sonnet', label: 'Claude Code', color: '#06b6d4', vendor: 'Anthropic' },
  { key: 'python', name: 'Python 3.10 Kernel', label: 'Python Kernel', color: '#10b981', vendor: 'Local Runtime' },
  { key: 'hermes', name: 'Hermes 3 405B', label: 'Hermes Agent', color: '#a855f7', vendor: 'Nous Research' },
  { key: 'node', name: 'Node.js v22', label: 'Node Runtime', color: '#f59e0b', vendor: 'V8 Engine' },
  { key: 'codex', name: 'Codex Sandbox', label: 'Codex Engine', color: '#3b82f6', vendor: 'OpenAI' },
  { key: 'others', name: 'Fallback Nodes', label: 'Other Agents', color: '#94a3b8', vendor: 'Cluster Pool' },
];

export interface OmniRouteD3ChartProps {
  data: TimeSeriesPoint[];
  isStreaming?: boolean;
  onToggleStreaming?: () => void;
  latencyThreshold?: number;
  onLatencyThresholdChange?: (val: number) => void;
  visibleAgents?: Record<string, boolean>;
  onToggleAgentVisibility?: (agentKey: string) => void;
  onSelectAllAgents?: () => void;
  onDeselectAllAgents?: () => void;
}

export type ChartMode = 'overview' | 'throughput' | 'latency' | 'agent_load';

export const OmniRouteD3Chart: React.FC<OmniRouteD3ChartProps> = ({
  data,
  isStreaming: propIsStreaming,
  onToggleStreaming,
  latencyThreshold: propLatencyThreshold,
  onLatencyThresholdChange,
  visibleAgents: propVisibleAgents,
  onToggleAgentVisibility,
  onSelectAllAgents,
  onDeselectAllAgents,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  // Chart view mode
  const [mode, setMode] = useState<ChartMode>('overview');
  const [dimensions, setDimensions] = useState({ width: 720, height: 330 });

  // Internal state fallbacks if not controlled from parent
  const [internalStreaming, setInternalStreaming] = useState(true);
  const isStreaming = propIsStreaming !== undefined ? propIsStreaming : internalStreaming;

  const [internalThreshold, setInternalThreshold] = useState<number>(26);
  const latencyThreshold = propLatencyThreshold !== undefined ? propLatencyThreshold : internalThreshold;

  const [internalVisibleAgents, setInternalVisibleAgents] = useState<Record<string, boolean>>({
    claude: true,
    python: true,
    hermes: true,
    node: true,
    codex: true,
    others: true,
  });
  const visibleAgents = propVisibleAgents || internalVisibleAgents;

  // Filter dropdown toggle
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  // Threshold edit popover
  const [isThresholdConfigOpen, setIsThresholdConfigOpen] = useState(false);

  // Hover and tooltip state
  const [hoveredPoint, setHoveredPoint] = useState<TimeSeriesPoint | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(e.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  // Handle stream pause/resume
  const handleToggleStreaming = () => {
    if (onToggleStreaming) {
      onToggleStreaming();
    } else {
      omniRouterService.toggleSimulation();
      setInternalStreaming((prev) => !prev);
    }
  };

  // Handle latency threshold update
  const handleThresholdChange = (newVal: number) => {
    const clamped = Math.max(5, Math.min(80, Math.round(newVal)));
    if (onLatencyThresholdChange) {
      onLatencyThresholdChange(clamped);
    } else {
      setInternalThreshold(clamped);
    }
  };

  // Handle agent visibility toggle
  const handleAgentToggle = (key: string) => {
    if (onToggleAgentVisibility) {
      onToggleAgentVisibility(key);
    } else {
      setInternalVisibleAgents((prev) => ({ ...prev, [key]: !prev[key] }));
    }
  };

  const handleSelectAll = () => {
    if (onSelectAllAgents) {
      onSelectAllAgents();
    } else {
      setInternalVisibleAgents({
        claude: true,
        python: true,
        hermes: true,
        node: true,
        codex: true,
        others: true,
      });
    }
  };

  const handleDeselectAll = () => {
    if (onDeselectAllAgents) {
      onDeselectAllAgents();
    } else {
      setInternalVisibleAgents({
        claude: false,
        python: false,
        hermes: false,
        node: false,
        codex: false,
        others: false,
      });
    }
  };

  // Count active agents
  const visibleAgentCount = useMemo(() => {
    return Object.values(visibleAgents).filter(Boolean).length;
  }, [visibleAgents]);

  // Dynamic responsiveness via ResizeObserver
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (!entries || entries.length === 0) return;
      const entry = entries[0];
      const newWidth = Math.max(320, Math.floor(entry.contentRect.width));
      const newHeight = Math.max(280, Math.floor(entry.contentRect.height || 330));
      setDimensions({ width: newWidth, height: newHeight });
    });

    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Compute live aggregates & baseline violation count
  const latestPoint = data.length > 0 ? data[data.length - 1] : null;

  const avgThroughput = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.round(data.reduce((acc, d) => acc + d.throughput, 0) / data.length);
  }, [data]);

  const maxThroughput = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.max(...data.map((d) => d.throughput));
  }, [data]);

  const avgLatency = useMemo(() => {
    if (data.length === 0) return 0;
    return Math.round(data.reduce((acc, d) => acc + d.avgLatency, 0) / data.length);
  }, [data]);

  // Points exceeding baseline in current window
  const thresholdViolations = useMemo(() => {
    return data.filter((d) => d.avgLatency > latencyThreshold);
  }, [data, latencyThreshold]);

  // ── D3 Rendering Engine ──
  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clean redraw

    const margin = {
      top: 28,
      right: mode === 'overview' ? 62 : 44,
      bottom: 38,
      left: 52,
    };
    const innerWidth = Math.max(120, dimensions.width - margin.left - margin.right);
    const innerHeight = Math.max(120, dimensions.height - margin.top - margin.bottom);

    // Defs for gradients, patterns, and filters
    const defs = svg.append('defs');

    // Throughput Cyan Gradient
    const gradCyan = defs
      .append('linearGradient')
      .attr('id', 'grad-cyan')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradCyan.append('stop').attr('offset', '0%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.45);
    gradCyan.append('stop').attr('offset', '80%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0.05);
    gradCyan.append('stop').attr('offset', '100%').attr('stop-color', '#06b6d4').attr('stop-opacity', 0);

    // Latency Amber Gradient
    const gradAmber = defs
      .append('linearGradient')
      .attr('id', 'grad-amber')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradAmber.append('stop').attr('offset', '0%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0.4);
    gradAmber.append('stop').attr('offset', '100%').attr('stop-color', '#f59e0b').attr('stop-opacity', 0);

    // Red Danger Region Gradient for Baseline Exceeded
    const gradRedDanger = defs
      .append('linearGradient')
      .attr('id', 'grad-red-danger')
      .attr('x1', '0%')
      .attr('y1', '0%')
      .attr('x2', '0%')
      .attr('y2', '100%');
    gradRedDanger.append('stop').attr('offset', '0%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.55);
    gradRedDanger.append('stop').attr('offset', '100%').attr('stop-color', '#ef4444').attr('stop-opacity', 0.1);

    // Subtle hazard diagonal stripes for threshold violation zones
    const stripePattern = defs
      .append('pattern')
      .attr('id', 'danger-stripes')
      .attr('width', 8)
      .attr('height', 8)
      .attr('patternUnits', 'userSpaceOnUse')
      .attr('patternTransform', 'rotate(45)');
    stripePattern
      .append('line')
      .attr('x1', 0)
      .attr('y1', 0)
      .attr('x2', 0)
      .attr('y2', 8)
      .attr('stroke', '#ef4444')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.2);

    // Filter glow cyan
    const filter = defs.append('filter').attr('id', 'glow-cyan').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filter.append('feGaussianBlur').attr('stdDeviation', '2.5').attr('result', 'blur');
    filter.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    // Filter glow red for threshold alert
    const filterRed = defs.append('filter').attr('id', 'glow-red').attr('x', '-20%').attr('y', '-20%').attr('width', '140%').attr('height', '140%');
    filterRed.append('feGaussianBlur').attr('stdDeviation', '3').attr('result', 'blur');
    filterRed.append('feComposite').attr('in', 'SourceGraphic').attr('in2', 'blur').attr('operator', 'over');

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    // X Scale (Time)
    const timeExtent = d3.extent(data, (d: TimeSeriesPoint) => new Date(d.timestamp));
    const domainExtent: [Date, Date] = timeExtent[0] && timeExtent[1] ? timeExtent : [new Date(), new Date()];
    const xScale = d3.scaleTime().domain(domainExtent).range([0, innerWidth]);

    // Gridlines (Horizontal)
    const yGridScale = d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]);
    g.append('g')
      .attr('class', 'grid')
      .call(
        d3
          .axisLeft(yGridScale)
          .ticks(5)
          .tickSize(-innerWidth)
          .tickFormat(() => '')
      )
      .call((group) => group.select('.domain').remove())
      .call((group) =>
        group
          .selectAll('line')
          .attr('stroke', '#1e293b')
          .attr('stroke-dasharray', '3,3')
          .attr('stroke-opacity', 0.6)
      );

    // Reference to latency y-scale for threshold calculations across modes
    let currentYLatency: d3.ScaleLinear<number, number> | null = null;
    let currentYThroughput: d3.ScaleLinear<number, number> | null = null;

    // Helper: draw threshold line and red highlight regions
    const renderLatencyThresholdVisuals = (yLatScale: d3.ScaleLinear<number, number>) => {
      currentYLatency = yLatScale;
      const threshY = yLatScale(latencyThreshold);

      // 1. Highlight regions in red on chart background for slices exceeding baseline
      data.forEach((pt, idx) => {
        if (pt.avgLatency > latencyThreshold) {
          const ptX = xScale(new Date(pt.timestamp));
          const prevPt = data[idx - 1];
          const nextPt = data[idx + 1];
          const leftX = prevPt ? (ptX + xScale(new Date(prevPt.timestamp))) / 2 : ptX - 10;
          const rightX = nextPt ? (ptX + xScale(new Date(nextPt.timestamp))) / 2 : ptX + 10;
          const rectW = Math.max(6, rightX - leftX);

          // Vertical danger zone highlight
          g.append('rect')
            .attr('x', leftX)
            .attr('y', 0)
            .attr('width', rectW)
            .attr('height', innerHeight)
            .attr('fill', 'rgba(239, 68, 68, 0.08)')
            .attr('stroke', 'none');

          // Diagonal hazard texture top banner
          g.append('rect')
            .attr('x', leftX)
            .attr('y', 0)
            .attr('width', rectW)
            .attr('height', 4)
            .attr('fill', '#ef4444')
            .attr('opacity', 0.85);
        }
      });

      // 2. Shaded red area fill above the threshold baseline
      const dangerArea = d3
        .area<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0(threshY)
        .y1((d) => yLatScale(Math.max(d.avgLatency, latencyThreshold)))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'url(#grad-red-danger)')
        .attr('d', dangerArea);

      // 3. Configurable Baseline Horizontal Line
      if (threshY >= 0 && threshY <= innerHeight) {
        g.append('line')
          .attr('class', 'threshold-baseline-line')
          .attr('x1', 0)
          .attr('x2', innerWidth)
          .attr('y1', threshY)
          .attr('y2', threshY)
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 1.8)
          .attr('stroke-dasharray', '5,3')
          .attr('filter', 'url(#glow-red)');

        // Threshold baseline text tag
        const tagGroup = g.append('g').attr('transform', `translate(${innerWidth - 130}, ${threshY - 6})`);
        tagGroup
          .append('rect')
          .attr('x', -6)
          .attr('y', -10)
          .attr('width', 136)
          .attr('height', 16)
          .attr('rx', 4)
          .attr('fill', 'rgba(239, 68, 68, 0.25)')
          .attr('stroke', '#ef4444')
          .attr('stroke-width', 1);

        tagGroup
          .append('text')
          .attr('x', 62)
          .attr('y', 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#fca5a5')
          .attr('class', 'font-mono text-[9px] font-bold')
          .text(`BASELINE SLA: ${latencyThreshold}ms`);
      }

      // 4. Highlight specific data points exceeding threshold with pulsating red markers
      data.forEach((d) => {
        if (d.avgLatency > latencyThreshold) {
          const ptX = xScale(new Date(d.timestamp));
          const ptY = yLatScale(d.avgLatency);

          g.append('circle')
            .attr('cx', ptX)
            .attr('cy', ptY)
            .attr('r', 3.5)
            .attr('fill', '#ef4444')
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1.2);

          g.append('circle')
            .attr('cx', ptX)
            .attr('cy', ptY)
            .attr('r', 7)
            .attr('fill', 'none')
            .attr('stroke', '#ef4444')
            .attr('stroke-width', 1)
            .attr('opacity', 0.5);
        }
      });
    };

    // ── Mode: OVERVIEW (Dual Axis: Throughput on left, Latency on right) ──
    if (mode === 'overview') {
      const maxTp = Math.max(40, d3.max(data, (d: TimeSeriesPoint) => d.throughput) ?? 100);
      const yThroughput = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxTp * 1.25)])
        .range([innerHeight, 0]);
      currentYThroughput = yThroughput;

      const maxLatVal = Math.max(latencyThreshold + 10, d3.max(data, (d: TimeSeriesPoint) => d.p95Latency) ?? 60);
      const yLatency = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxLatVal * 1.25)])
        .range([innerHeight, 0]);
      currentYLatency = yLatency;

      // Render red threshold indicators first (under lines)
      renderLatencyThresholdVisuals(yLatency);

      // Throughput Area
      const tpArea = d3
        .area<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0(innerHeight)
        .y1((d) => yThroughput(d.throughput))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(data).attr('fill', 'url(#grad-cyan)').attr('d', tpArea);

      // Throughput Line
      const tpLine = d3
        .line<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yThroughput(d.throughput))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 2.2)
        .attr('filter', 'url(#glow-cyan)')
        .attr('d', tpLine);

      // Latency Line (Amber base, red sections when exceeding threshold)
      const latLine = d3
        .line<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yLatency(d.avgLatency))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('d', latLine);

      // Left Axis (Throughput)
      const leftAxis = d3.axisLeft(yThroughput).ticks(5).tickFormat((d) => `${d}`);
      g.append('g')
        .attr('class', 'y-axis-throughput font-mono text-[10px]')
        .call(leftAxis)
        .call((group) => group.select('.domain').attr('stroke', '#334155'))
        .call((group) => group.selectAll('text').attr('fill', '#06b6d4'));

      // Left Axis Label
      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -38)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#06b6d4')
        .attr('class', 'font-mono text-[9px] uppercase tracking-wider font-semibold')
        .text('Throughput (req/s)');

      // Right Axis (Latency)
      const rightAxis = d3.axisRight(yLatency).ticks(5).tickFormat((d) => `${d}ms`);
      g.append('g')
        .attr('transform', `translate(${innerWidth},0)`)
        .attr('class', 'y-axis-latency font-mono text-[10px]')
        .call(rightAxis)
        .call((group) => group.select('.domain').attr('stroke', '#334155'))
        .call((group) => group.selectAll('text').attr('fill', '#f59e0b'));

      // Right Axis Label
      g.append('text')
        .attr('transform', 'rotate(90)')
        .attr('y', -innerWidth - 48)
        .attr('x', innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f59e0b')
        .attr('class', 'font-mono text-[9px] uppercase tracking-wider font-semibold')
        .text('Latency (ms)');

      // Live pulse dot on latest point
      const last = data[data.length - 1];
      if (last && isStreaming) {
        const lastX = xScale(new Date(last.timestamp));
        const lastY = yThroughput(last.throughput);

        g.append('circle')
          .attr('cx', lastX)
          .attr('cy', lastY)
          .attr('r', 4.5)
          .attr('fill', '#06b6d4')
          .attr('stroke', '#ffffff')
          .attr('stroke-width', 1.5);

        g.append('circle')
          .attr('cx', lastX)
          .attr('cy', lastY)
          .attr('r', 9)
          .attr('fill', 'none')
          .attr('stroke', '#06b6d4')
          .attr('stroke-width', 1)
          .attr('opacity', 0.6)
          .attr('class', 'animate-ping');
      }
    }

    // ── Mode: THROUGHPUT ──
    else if (mode === 'throughput') {
      const maxTp = Math.max(50, d3.max(data, (d: TimeSeriesPoint) => d.throughput) ?? 100);
      const yScale = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxTp * 1.2)])
        .range([innerHeight, 0]);
      currentYThroughput = yScale;

      // Gradient Area
      const tpArea = d3
        .area<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0(innerHeight)
        .y1((d) => yScale(d.throughput))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(data).attr('fill', 'url(#grad-cyan)').attr('d', tpArea);

      // Line
      const tpLine = d3
        .line<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yScale(d.throughput))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 2.4)
        .attr('filter', 'url(#glow-cyan)')
        .attr('d', tpLine);

      // Average Line Reference
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(avgThroughput))
        .attr('y2', yScale(avgThroughput))
        .attr('stroke', '#38bdf8')
        .attr('stroke-dasharray', '5,4')
        .attr('stroke-width', 1.2)
        .attr('opacity', 0.8);

      g.append('text')
        .attr('x', innerWidth - 6)
        .attr('y', yScale(avgThroughput) - 4)
        .attr('text-anchor', 'end')
        .attr('fill', '#38bdf8')
        .attr('class', 'font-mono text-[9px]')
        .text(`Average: ${avgThroughput} req/s`);

      // Left Axis
      g.append('g')
        .attr('class', 'y-axis font-mono text-[10px]')
        .call(d3.axisLeft(yScale).ticks(5))
        .call((group) => group.select('.domain').attr('stroke', '#334155'))
        .call((group) => group.selectAll('text').attr('fill', '#94a3b8'));

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -38)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#06b6d4')
        .attr('class', 'font-mono text-[9px] uppercase tracking-wider font-semibold')
        .text('Requests / sec');
    }

    // ── Mode: LATENCY & P95 ──
    else if (mode === 'latency') {
      const maxLatVal = Math.max(
        latencyThreshold + 10,
        d3.max(data, (d: TimeSeriesPoint) => d.p95Latency) ?? 70
      );
      const yScale = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxLatVal * 1.25)])
        .range([innerHeight, 0]);
      currentYLatency = yScale;

      // Render red threshold indicators first
      renderLatencyThresholdVisuals(yScale);

      // P95 Area fill
      const p95Area = d3
        .area<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y0((d) => yScale(d.avgLatency))
        .y1((d) => yScale(d.p95Latency))
        .curve(d3.curveMonotoneX);

      g.append('path').datum(data).attr('fill', 'url(#grad-amber)').attr('d', p95Area);

      // P95 Line (Rose/Red)
      const p95Line = d3
        .line<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yScale(d.p95Latency))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#fb7185')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '4,3')
        .attr('d', p95Line);

      // Avg Latency Line (Amber)
      const avgLine = d3
        .line<TimeSeriesPoint>()
        .x((d) => xScale(new Date(d.timestamp)))
        .y((d) => yScale(d.avgLatency))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(data)
        .attr('fill', 'none')
        .attr('stroke', '#f59e0b')
        .attr('stroke-width', 2.4)
        .attr('d', avgLine);

      // Router Overhead Baseline (Cyan ~0.12ms)
      g.append('line')
        .attr('x1', 0)
        .attr('x2', innerWidth)
        .attr('y1', yScale(1))
        .attr('y2', yScale(1))
        .attr('stroke', '#06b6d4')
        .attr('stroke-width', 1.5)
        .attr('opacity', 0.7);

      g.append('text')
        .attr('x', 8)
        .attr('y', yScale(1) - 4)
        .attr('fill', '#06b6d4')
        .attr('class', 'font-mono text-[9px]')
        .text('Router Dispatch Overhead: 0.12ms');

      // Left Axis
      g.append('g')
        .attr('class', 'y-axis font-mono text-[10px]')
        .call(d3.axisLeft(yScale).ticks(5).tickFormat((d) => `${d}ms`))
        .call((group) => group.select('.domain').attr('stroke', '#334155'))
        .call((group) => group.selectAll('text').attr('fill', '#94a3b8'));

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -38)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#f59e0b')
        .attr('class', 'font-mono text-[9px] uppercase tracking-wider font-semibold')
        .text('Latency (ms)');
    }

    // ── Mode: AGENT LOAD DISTRIBUTION (Filtered by visibleAgents) ──
    else if (mode === 'agent_load') {
      const activeAgents = AGENT_TRACK_ITEMS.filter((item) => visibleAgents[item.key] !== false);

      const maxLoad = Math.max(
        25,
        d3.max(data, (d: TimeSeriesPoint) => {
          const loads = activeAgents.map((a) => (d.agentLoads as any)[a.key] || 0);
          return loads.length > 0 ? Math.max(...loads) : 0;
        }) ?? 35
      );

      const yScale = d3
        .scaleLinear()
        .domain([0, Math.ceil(maxLoad * 1.25)])
        .range([innerHeight, 0]);

      if (activeAgents.length === 0) {
        g.append('text')
          .attr('x', innerWidth / 2)
          .attr('y', innerHeight / 2)
          .attr('text-anchor', 'middle')
          .attr('fill', '#64748b')
          .attr('class', 'font-mono text-xs')
          .text('All agents hidden. Use Filter dropdown to toggle agent visibility.');
      } else {
        // Render visible agent load lines
        activeAgents.forEach((agent) => {
          const lineGen = d3
            .line<TimeSeriesPoint>()
            .x((d) => xScale(new Date(d.timestamp)))
            .y((d) => yScale((d.agentLoads as any)[agent.key] || 0))
            .curve(d3.curveMonotoneX);

          g.append('path')
            .datum(data)
            .attr('fill', 'none')
            .attr('stroke', agent.color)
            .attr('stroke-width', 2.2)
            .attr('d', lineGen);
        });
      }

      // Left Axis
      g.append('g')
        .attr('class', 'y-axis font-mono text-[10px]')
        .call(d3.axisLeft(yScale).ticks(5))
        .call((group) => group.select('.domain').attr('stroke', '#334155'))
        .call((group) => group.selectAll('text').attr('fill', '#94a3b8'));

      g.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', -38)
        .attr('x', -innerHeight / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', '#a855f7')
        .attr('class', 'font-mono text-[9px] uppercase tracking-wider font-semibold')
        .text('Agent Workload (req/s)');
    }

    // Common Bottom Time Axis
    const bottomAxis = d3
      .axisBottom(xScale)
      .ticks(Math.max(3, Math.floor(innerWidth / 110)))
      .tickFormat((d) => d3.timeFormat('%H:%M:%S')(d as Date));

    g.append('g')
      .attr('transform', `translate(0,${innerHeight})`)
      .attr('class', 'x-axis font-mono text-[9px]')
      .call(bottomAxis)
      .call((group) => group.select('.domain').attr('stroke', '#334155'))
      .call((group) => group.selectAll('text').attr('fill', '#64748b'));

    // ── Interactive Hover Crosshair & Data Point Tracking ──
    const overlay = g
      .append('rect')
      .attr('class', 'overlay')
      .attr('width', innerWidth)
      .attr('height', innerHeight)
      .attr('fill', 'transparent')
      .attr('cursor', 'crosshair');

    const trackingLine = g
      .append('line')
      .attr('class', 'tracking-line')
      .attr('stroke', '#94a3b8')
      .attr('stroke-dasharray', '3,3')
      .attr('stroke-width', 1.2)
      .attr('opacity', 0)
      .attr('y1', 0)
      .attr('y2', innerHeight);

    // Dynamic hover indicators
    const circleTp = g
      .append('circle')
      .attr('class', 'hover-tp-circle')
      .attr('r', 5)
      .attr('fill', '#06b6d4')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.8)
      .attr('opacity', 0);

    const circleLat = g
      .append('circle')
      .attr('class', 'hover-lat-circle')
      .attr('r', 5)
      .attr('fill', '#f59e0b')
      .attr('stroke', '#ffffff')
      .attr('stroke-width', 1.8)
      .attr('opacity', 0);

    const bisect = d3.bisector<TimeSeriesPoint, Date>((d) => new Date(d.timestamp)).left;

    overlay
      .on('mousemove', function (event) {
        const [mx] = d3.pointer(event, this);
        const x0 = xScale.invert(mx);
        const i = bisect(data, x0, 1);
        const d0 = data[i - 1];
        const d1 = data[i];
        let d = d0;
        if (d0 && d1) {
          d = x0.getTime() - d0.timestamp > d1.timestamp - x0.getTime() ? d1 : d0;
        }

        if (d) {
          const cx = xScale(new Date(d.timestamp));
          trackingLine.attr('x1', cx).attr('x2', cx).attr('opacity', 0.9);

          // Update throughput focal circle
          if (currentYThroughput) {
            circleTp
              .attr('cx', cx)
              .attr('cy', currentYThroughput(d.throughput))
              .attr('opacity', 1);
          } else {
            circleTp.attr('opacity', 0);
          }

          // Update latency focal circle (red if exceeding baseline!)
          if (currentYLatency) {
            const isAlert = d.avgLatency > latencyThreshold;
            circleLat
              .attr('cx', cx)
              .attr('cy', currentYLatency(d.avgLatency))
              .attr('fill', isAlert ? '#ef4444' : '#f59e0b')
              .attr('opacity', 1);
          } else {
            circleLat.attr('opacity', 0);
          }

          setHoveredPoint(d);
          setHoverCoords({ x: cx + margin.left, y: Math.max(20, (currentYLatency ? currentYLatency(d.avgLatency) : 100) + margin.top) });
        }
      })
      .on('mouseleave', () => {
        trackingLine.attr('opacity', 0);
        circleTp.attr('opacity', 0);
        circleLat.attr('opacity', 0);
        setHoveredPoint(null);
        setHoverCoords(null);
      });
  }, [data, mode, dimensions, avgThroughput, latencyThreshold, visibleAgents, isStreaming]);

  return (
    <div className="flex flex-col rounded-2xl border border-slate-800 bg-[#0a0e1a] p-4 shadow-xl space-y-3">
      {/* ── Header Controls: Real-time status, Pause/Resume, Filter dropdown & Threshold ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
        {/* Title & Live Status Indicator */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-bold font-mono tracking-wider uppercase text-white">
                REAL-TIME TELEMETRY STREAM
              </h3>

              {/* Pause / Resume Live Streaming Toggle Button */}
              <button
                onClick={handleToggleStreaming}
                className={`flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border transition cursor-pointer ${
                  isStreaming
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/25'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40 hover:bg-amber-500/25'
                }`}
                title={isStreaming ? 'Click to Pause real-time telemetry stream' : 'Click to Resume real-time telemetry stream'}
              >
                {isStreaming ? (
                  <>
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    <Pause size={10} className="ml-0.5" />
                    <span>STREAMING</span>
                  </>
                ) : (
                  <>
                    <Play size={10} className="text-amber-400" />
                    <span>PAUSED</span>
                  </>
                )}
              </button>

              {/* Threshold Violation Indicator Badge */}
              {thresholdViolations.length > 0 ? (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-rose-500/15 text-rose-300 border border-rose-500/40">
                  <AlertTriangle size={10} className="text-rose-400" />
                  <span>{thresholdViolations.length} OVER BASELINE</span>
                </span>
              ) : (
                <span className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <CheckCircle2 size={10} />
                  <span>WITHIN BASELINE</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400 font-mono">
              2000ms sliding window · {isStreaming ? 'Synchronized with live OmniRouter daemon' : 'Frozen for diagnostic inspection'}
            </p>
          </div>
        </div>

        {/* Action Controls: Agent Filter Dropdown, Baseline Latency Config, and Mode Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {/* 1. Filter Dropdown for Agent Visibility */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-mono transition cursor-pointer ${
                visibleAgentCount < AGENT_TRACK_ITEMS.length
                  ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                  : 'bg-[#121829] text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Toggle visibility of specific agents in the D3.js chart"
            >
              <Filter size={12} className={visibleAgentCount < AGENT_TRACK_ITEMS.length ? 'text-purple-400' : 'text-slate-400'} />
              <span>Agents ({visibleAgentCount}/{AGENT_TRACK_ITEMS.length})</span>
              <ChevronDown size={11} className={`transition-transform duration-200 ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Dropdown Popover */}
            {isFilterOpen && (
              <div className="absolute right-0 mt-1.5 w-64 bg-[#0d1322] border border-slate-700 rounded-xl p-2.5 shadow-2xl z-40 space-y-2 backdrop-blur-xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Filter Agent Visibility
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleSelectAll}
                      className="text-[10px] font-mono text-cyan-400 hover:text-cyan-300 cursor-pointer"
                    >
                      All
                    </button>
                    <span className="text-slate-600 text-[10px]">·</span>
                    <button
                      onClick={handleDeselectAll}
                      className="text-[10px] font-mono text-slate-400 hover:text-rose-400 cursor-pointer"
                    >
                      None
                    </button>
                  </div>
                </div>

                <div className="space-y-1 max-h-56 overflow-y-auto">
                  {AGENT_TRACK_ITEMS.map((agent) => {
                    const isChecked = visibleAgents[agent.key] !== false;
                    return (
                      <button
                        key={agent.key}
                        onClick={() => handleAgentToggle(agent.key)}
                        className={`w-full flex items-center justify-between p-1.5 rounded-lg text-left transition cursor-pointer text-xs font-mono ${
                          isChecked ? 'bg-slate-800/60 text-white' : 'text-slate-500 hover:bg-slate-800/30'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full border"
                            style={{
                              backgroundColor: isChecked ? agent.color : 'transparent',
                              borderColor: agent.color,
                            }}
                          />
                          <div>
                            <div className="text-[11px] font-semibold">{agent.label}</div>
                            <div className="text-[9px] text-slate-400">{agent.vendor}</div>
                          </div>
                        </div>
                        <div
                          className={`w-4 h-4 rounded flex items-center justify-center border transition ${
                            isChecked
                              ? 'bg-cyan-500 border-cyan-400 text-slate-950'
                              : 'border-slate-700 text-transparent'
                          }`}
                        >
                          <Check size={10} strokeWidth={3} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* 2. Configurable Latency Baseline Threshold */}
          <div className="relative">
            <button
              onClick={() => setIsThresholdConfigOpen(!isThresholdConfigOpen)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-mono transition cursor-pointer ${
                thresholdViolations.length > 0
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold'
                  : 'bg-[#121829] text-slate-300 border-slate-700 hover:border-slate-500'
              }`}
              title="Configure baseline latency SLA threshold (red highlight trigger)"
            >
              <Gauge size={12} className={thresholdViolations.length > 0 ? 'text-rose-400' : 'text-amber-400'} />
              <span>Threshold: <strong className="text-white">{latencyThreshold}ms</strong></span>
            </button>

            {/* Threshold Config Popover */}
            {isThresholdConfigOpen && (
              <div className="absolute right-0 mt-1.5 w-60 bg-[#0d1322] border border-slate-700 rounded-xl p-3 shadow-2xl z-40 space-y-2.5 backdrop-blur-xl animate-in fade-in duration-150">
                <div className="flex items-center justify-between border-b border-slate-800 pb-1">
                  <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                    Latency Baseline Threshold
                  </span>
                  <button
                    onClick={() => setIsThresholdConfigOpen(false)}
                    className="text-slate-500 hover:text-white cursor-pointer"
                  >
                    <X size={12} />
                  </button>
                </div>

                <div className="text-[10px] text-slate-400 font-mono">
                  Regions & data points exceeding this threshold are highlighted in red.
                </div>

                <div className="flex items-center gap-2 font-mono">
                  <input
                    type="range"
                    min={10}
                    max={60}
                    step={1}
                    value={latencyThreshold}
                    onChange={(e) => handleThresholdChange(Number(e.target.value))}
                    className="flex-1 accent-rose-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
                  />
                  <span className="text-xs font-bold text-rose-400 w-12 text-right">
                    {latencyThreshold} ms
                  </span>
                </div>

                {/* Quick Presets */}
                <div className="grid grid-cols-4 gap-1 pt-1 font-mono text-[10px]">
                  {[20, 25, 30, 40].map((preset) => (
                    <button
                      key={preset}
                      onClick={() => handleThresholdChange(preset)}
                      className={`py-1 rounded border text-center transition cursor-pointer ${
                        latencyThreshold === preset
                          ? 'bg-rose-500 text-white font-bold border-rose-400'
                          : 'bg-slate-800/80 text-slate-400 hover:text-white border-slate-700'
                      }`}
                    >
                      {preset}ms
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 3. Mode Selector Tabs */}
          <div className="flex items-center space-x-1 bg-[#121829] p-1 rounded-xl border border-slate-800 text-xs font-mono">
            <button
              onClick={() => setMode('overview')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mode === 'overview'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Overview
            </button>

            <button
              onClick={() => setMode('throughput')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mode === 'throughput'
                  ? 'bg-cyan-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Throughput
            </button>

            <button
              onClick={() => setMode('latency')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mode === 'latency'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Latency & SLA
            </button>

            <button
              onClick={() => setMode('agent_load')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer text-[11px] ${
                mode === 'agent_load'
                  ? 'bg-purple-500 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Agent Load
            </button>
          </div>
        </div>
      </div>

      {/* ── Realtime Stats Ribbon ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="bg-[#121829] p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase text-slate-400">Current Throughput</span>
            <TrendingUp size={11} className="text-cyan-400" />
          </div>
          <div className="text-lg font-bold text-cyan-400 mt-0.5">
            {latestPoint?.throughput || 0} <span className="text-[10px] text-slate-400">req/s</span>
          </div>
          <span className="text-[9px] text-slate-400">Peak: {maxThroughput} req/s</span>
        </div>

        <div className="bg-[#121829] p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase text-slate-400">Current Latency</span>
            <Clock size={11} className={latestPoint && latestPoint.avgLatency > latencyThreshold ? 'text-rose-400' : 'text-amber-400'} />
          </div>
          <div className="text-lg font-bold mt-0.5 flex items-baseline gap-1.5">
            <span className={latestPoint && latestPoint.avgLatency > latencyThreshold ? 'text-rose-400' : 'text-amber-400'}>
              {latestPoint?.avgLatency || 0}
            </span>
            <span className="text-[10px] text-slate-400">ms</span>
            {latestPoint && latestPoint.avgLatency > latencyThreshold && (
              <span className="text-[9px] text-rose-400 font-bold">⚠️ EXCEEDED</span>
            )}
          </div>
          <span className="text-[9px] text-slate-400">p95 Spike: {latestPoint?.p95Latency || 0} ms</span>
        </div>

        <div className="bg-[#121829] p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase text-slate-400">Baseline SLA</span>
            <Gauge size={11} className="text-rose-400" />
          </div>
          <div className="text-lg font-bold text-rose-400 mt-0.5">
            {latencyThreshold} <span className="text-[10px] text-slate-400">ms limit</span>
          </div>
          <span className="text-[9px] text-slate-400">
            {thresholdViolations.length > 0 ? `${thresholdViolations.length} breaches in sample` : 'Zero SLA breaches'}
          </span>
        </div>

        <div className="bg-[#121829] p-2.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase text-slate-400">Router Overhead</span>
            <Zap size={11} className="text-emerald-400" />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-0.5">
            {latestPoint?.routerOverhead || 0.12} <span className="text-[10px] text-slate-400">ms</span>
          </div>
          <span className="text-[9px] text-slate-400">Zero-lock atomic routing</span>
        </div>
      </div>

      {/* ── D3 Chart Stage ── */}
      <div
        ref={containerRef}
        className="relative w-full h-[300px] min-h-[270px] bg-[#070a13] rounded-xl border border-slate-800/70 overflow-hidden"
      >
        <svg
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          className="w-full h-full block"
        />

        {/* Legend Overlay in Chart Header */}
        <div className="absolute top-2 right-3 flex flex-wrap items-center gap-2.5 text-[10px] font-mono bg-[#0e1424]/90 backdrop-blur-md px-3 py-1 rounded-lg border border-slate-800">
          {mode === 'overview' && (
            <>
              <div className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Throughput</span>
              </div>
              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-0.5 bg-amber-400" />
                <span>Latency</span>
              </div>
              <div className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-400 border-b border-dashed" />
                <span>Baseline ({latencyThreshold}ms)</span>
              </div>
            </>
          )}

          {mode === 'throughput' && (
            <>
              <div className="flex items-center gap-1 text-cyan-400">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                <span>Throughput Curve</span>
              </div>
              <div className="flex items-center gap-1 text-sky-300">
                <span className="w-2 h-0.5 bg-sky-300 border-b border-dashed" />
                <span>Avg ({avgThroughput} r/s)</span>
              </div>
            </>
          )}

          {mode === 'latency' && (
            <>
              <div className="flex items-center gap-1 text-amber-400">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>Avg Latency</span>
              </div>
              <div className="flex items-center gap-1 text-rose-400">
                <span className="w-2 h-0.5 bg-rose-400 border-b border-dashed" />
                <span>p95 Spike</span>
              </div>
              <div className="flex items-center gap-1 text-rose-500 font-bold">
                <span className="w-2 h-1 bg-rose-500 rounded-xs" />
                <span>Red Zone (&gt;{latencyThreshold}ms)</span>
              </div>
            </>
          )}

          {mode === 'agent_load' && (
            <div className="flex flex-wrap items-center gap-2 text-[9px]">
              {AGENT_TRACK_ITEMS.map((ag) => {
                const isVis = visibleAgents[ag.key] !== false;
                return (
                  <button
                    key={ag.key}
                    onClick={() => handleAgentToggle(ag.key)}
                    className={`flex items-center gap-1 transition cursor-pointer ${
                      isVis ? '' : 'line-through opacity-40'
                    }`}
                    style={{ color: ag.color }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: ag.color }} />
                    <span>{ag.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Interactive Floating Tooltip: Exact Latency & Throughput Values ── */}
        {hoveredPoint && (
          <div
            className="absolute z-30 pointer-events-none transition-transform duration-75 ease-out font-mono text-xs"
            style={{
              left: hoverCoords ? Math.min(dimensions.width - 240, Math.max(16, hoverCoords.x - 110)) : 16,
              top: hoverCoords ? Math.max(12, Math.min(dimensions.height - 180, hoverCoords.y - 100)) : 12,
            }}
          >
            <div className="bg-[#0b101e]/95 border border-cyan-500/50 rounded-xl p-3 shadow-2xl backdrop-blur-md w-56 space-y-2">
              {/* Header: Time & Sample */}
              <div className="flex items-center justify-between text-[10px] border-b border-slate-800 pb-1.5">
                <span className="text-white font-bold">{hoveredPoint.timeLabel}</span>
                <span className="text-cyan-400 text-[9px]">Sample #{data.indexOf(hoveredPoint) + 1}</span>
              </div>

              {/* Exact Latency & Throughput Metrics */}
              <div className="space-y-1.5 text-[11px]">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
                    Throughput:
                  </span>
                  <span className="text-cyan-300 font-bold">{hoveredPoint.throughput} req/s</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span
                      className="w-1.5 h-1.5 rounded-full"
                      style={{
                        backgroundColor: hoveredPoint.avgLatency > latencyThreshold ? '#ef4444' : '#f59e0b',
                      }}
                    />
                    Avg Latency:
                  </span>
                  <span
                    className={`font-bold ${
                      hoveredPoint.avgLatency > latencyThreshold ? 'text-rose-400' : 'text-amber-300'
                    }`}
                  >
                    {hoveredPoint.avgLatency} ms
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                    p95 Latency:
                  </span>
                  <span className="text-rose-300 font-bold">{hoveredPoint.p95Latency} ms</span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    Overhead:
                  </span>
                  <span className="text-emerald-300 font-bold">{hoveredPoint.routerOverhead} ms</span>
                </div>
              </div>

              {/* Threshold Baseline Status Alert */}
              <div className="border-t border-slate-800 pt-1.5">
                {hoveredPoint.avgLatency > latencyThreshold ? (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-bold">
                    <AlertTriangle size={11} className="shrink-0 text-rose-400" />
                    <span>
                      EXCEEDS BASELINE (+{(hoveredPoint.avgLatency - latencyThreshold).toFixed(1)}ms &gt; {latencyThreshold}ms)
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px]">
                    <CheckCircle2 size={11} className="shrink-0 text-emerald-400" />
                    <span>Within SLA Baseline (&le; {latencyThreshold}ms)</span>
                  </div>
                )}
              </div>

              {/* Visible Agent Load Breakdown in agent_load mode */}
              {mode === 'agent_load' && (
                <div className="border-t border-slate-800 pt-1.5 space-y-1">
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 block">
                    Active Agent Breakdown
                  </span>
                  <div className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-[10px]">
                    {AGENT_TRACK_ITEMS.filter((a) => visibleAgents[a.key] !== false).map((a) => (
                      <div key={a.key} className="flex items-center justify-between">
                        <span className="truncate text-slate-400" title={a.name}>
                          {a.label}:
                        </span>
                        <span className="font-bold" style={{ color: a.color }}>
                          {(hoveredPoint.agentLoads as any)[a.key] || 0}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
