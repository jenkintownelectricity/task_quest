import { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useApp } from '../store/context';
import { getTheme } from '../utils/theme';
import type { Task } from '../types/kernel';

interface NodePos {
  x: number;
  y: number;
  task: Task;
}

export function GraphView() {
  const { state, selectTask, editTask } = useApp();
  const theme = getTheme(state.preferences.theme);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });

  // Only show tasks that have edges
  const connectedTaskIds = useMemo(() => {
    const ids = new Set<string>();
    state.edges.forEach((e) => {
      ids.add(e.source);
      ids.add(e.target);
    });
    return ids;
  }, [state.edges]);

  const graphTasks = useMemo(() => {
    return state.tasks.filter((t) => connectedTaskIds.has(t.$lds.id) && t.status !== 'completed');
  }, [state.tasks, connectedTaskIds]);

  // Simple force-directed layout
  const nodePositions = useMemo(() => {
    const nodes: NodePos[] = [];
    const cx = 400;
    const cy = 300;
    const radius = Math.min(250, 60 * graphTasks.length / Math.PI);

    graphTasks.forEach((task, i) => {
      const angle = (2 * Math.PI * i) / graphTasks.length - Math.PI / 2;
      nodes.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        task,
      });
    });

    // Simple spring simulation
    for (let iter = 0; iter < 50; iter++) {
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const dx = nodes[j].x - nodes[i].x;
          const dy = nodes[j].y - nodes[i].y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const repulsion = 5000 / (dist * dist);
          const fx = (dx / dist) * repulsion;
          const fy = (dy / dist) * repulsion;
          nodes[i].x -= fx;
          nodes[i].y -= fy;
          nodes[j].x += fx;
          nodes[j].y += fy;
        }
      }

      // Edge attraction
      state.edges.forEach((edge) => {
        const src = nodes.find((n) => n.task.$lds.id === edge.source);
        const tgt = nodes.find((n) => n.task.$lds.id === edge.target);
        if (!src || !tgt) return;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const attraction = (dist - 120) * 0.01;
        const fx = (dx / dist) * attraction;
        const fy = (dy / dist) * attraction;
        src.x += fx;
        src.y += fy;
        tgt.x -= fx;
        tgt.y -= fy;
      });

      // Center gravity
      nodes.forEach((n) => {
        n.x += (cx - n.x) * 0.01;
        n.y += (cy - n.y) * 0.01;
      });
    }

    return nodes;
  }, [graphTasks, state.edges]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size.w * dpr;
    canvas.height = size.h * dpr;
    ctx.scale(dpr, dpr);

    ctx.clearRect(0, 0, size.w, size.h);
    ctx.save();
    ctx.translate(offset.x, offset.y);
    ctx.scale(zoom, zoom);

    // Draw edges
    state.edges.forEach((edge) => {
      const src = nodePositions.find((n) => n.task.$lds.id === edge.source);
      const tgt = nodePositions.find((n) => n.task.$lds.id === edge.target);
      if (!src || !tgt) return;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      const edgeColors: Record<string, string> = {
        blocks: theme.danger,
        depends_on: theme.warning,
        related_to: theme.textMuted,
        part_of: theme.primary,
        scheduled_after: theme.primaryLight,
      };

      ctx.strokeStyle = edgeColors[edge.type] || theme.border;
      ctx.lineWidth = 2;

      if (edge.type === 'related_to') {
        ctx.setLineDash([4, 4]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);

      // Arrow
      const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
      const arrowSize = 8;
      const arrowX = tgt.x - Math.cos(angle) * 30;
      const arrowY = tgt.y - Math.sin(angle) * 30;

      if (edge.type === 'blocks' || edge.type === 'depends_on' || edge.type === 'scheduled_after') {
        ctx.beginPath();
        ctx.moveTo(arrowX, arrowY);
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle - Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
          arrowX - arrowSize * Math.cos(angle + Math.PI / 6),
          arrowY - arrowSize * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fillStyle = edgeColors[edge.type] || theme.border;
        ctx.fill();
      }
    });

    // Draw nodes
    nodePositions.forEach((node) => {
      const isHovered = hoveredNode === node.task.$lds.id;
      const isSelected = state.selectedTaskId === node.task.$lds.id;
      const r = isHovered || isSelected ? 28 : 24;

      // Node circle
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2);
      ctx.fillStyle = isSelected
        ? theme.primary
        : isHovered
          ? theme.primaryLight
          : theme.surface;
      ctx.fill();
      ctx.strokeStyle = isSelected ? theme.primary : theme.border;
      ctx.lineWidth = 2;
      ctx.stroke();

      // Energy indicator
      const energyColors = { low: theme.energyLow, medium: theme.energyMed, high: theme.energyHigh };
      ctx.beginPath();
      ctx.arc(node.x, node.y, r, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2);
      ctx.strokeStyle = energyColors[node.task.energy];
      ctx.lineWidth = 3;
      ctx.stroke();

      // Label
      ctx.fillStyle = isSelected ? '#fff' : theme.text;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const label = node.task.title.length > 12
        ? node.task.title.substring(0, 11) + '...'
        : node.task.title;
      ctx.fillText(label, node.x, node.y + r + 16);
    });

    ctx.restore();
  }, [nodePositions, state.edges, zoom, offset, hoveredNode, state.selectedTaskId, theme, size]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left - offset.x) / zoom;
      const my = (e.clientY - rect.top - offset.y) / zoom;

      if (dragging) {
        setOffset({
          x: offset.x + (e.clientX - dragStart.x),
          y: offset.y + (e.clientY - dragStart.y),
        });
        setDragStart({ x: e.clientX, y: e.clientY });
        return;
      }

      let found: string | null = null;
      for (const node of nodePositions) {
        const dx = node.x - mx;
        const dy = node.y - my;
        if (dx * dx + dy * dy < 28 * 28) {
          found = node.task.$lds.id;
          break;
        }
      }
      setHoveredNode(found);
      canvas.style.cursor = found ? 'pointer' : dragging ? 'grabbing' : 'grab';
    },
    [nodePositions, zoom, offset, dragging, dragStart]
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredNode) {
        selectTask(hoveredNode);
      }
    },
    [hoveredNode, selectTask]
  );

  const handleDblClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (hoveredNode) {
        editTask(hoveredNode);
      }
    },
    [hoveredNode, editTask]
  );

  const resetView = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  if (graphTasks.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: theme.textMuted }}>
        <p style={{ fontSize: '16px', marginBottom: '8px' }}>No connected tasks yet</p>
        <p style={{ fontSize: '13px' }}>Tasks with relationships will appear here as a graph.</p>
      </div>
    );
  }

  // Edge type legend
  const edgeLegend = [
    { type: 'blocks', color: theme.danger, label: 'Blocks' },
    { type: 'depends_on', color: theme.warning, label: 'Depends on' },
    { type: 'part_of', color: theme.primary, label: 'Part of' },
    { type: 'scheduled_after', color: theme.primaryLight, label: 'After' },
    { type: 'related_to', color: theme.textMuted, label: 'Related' },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: theme.text, margin: 0 }}>
          Task Graph
        </h1>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={() => setZoom((z) => Math.min(z + 0.2, 3))}
            style={{
              background: theme.surfaceHover,
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: theme.textSecondary,
            }}
          >
            <ZoomIn size={16} />
          </button>
          <button
            onClick={() => setZoom((z) => Math.max(z - 0.2, 0.3))}
            style={{
              background: theme.surfaceHover,
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: theme.textSecondary,
            }}
          >
            <ZoomOut size={16} />
          </button>
          <button
            onClick={resetView}
            style={{
              background: theme.surfaceHover,
              border: 'none',
              borderRadius: '8px',
              padding: '8px',
              cursor: 'pointer',
              color: theme.textSecondary,
            }}
          >
            <Maximize2 size={16} />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
        {edgeLegend.map((item) => (
          <div key={item.type} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div
              style={{
                width: '16px',
                height: '3px',
                background: item.color,
                borderRadius: '2px',
              }}
            />
            <span style={{ fontSize: '11px', color: theme.textMuted }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* Canvas */}
      <div
        ref={containerRef}
        style={{
          background: theme.surface,
          border: `1px solid ${theme.border}`,
          borderRadius: '16px',
          overflow: 'hidden',
          height: 'calc(100vh - 260px)',
          minHeight: '400px',
        }}
      >
        <canvas
          ref={canvasRef}
          style={{ width: '100%', height: '100%' }}
          onMouseMove={handleMouseMove}
          onClick={handleClick}
          onDoubleClick={handleDblClick}
          onMouseDown={(e) => {
            if (!hoveredNode) {
              setDragging(true);
              setDragStart({ x: e.clientX, y: e.clientY });
            }
          }}
          onMouseUp={() => setDragging(false)}
          onMouseLeave={() => {
            setDragging(false);
            setHoveredNode(null);
          }}
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            setZoom((z) => Math.max(0.3, Math.min(3, z + delta)));
          }}
        />
      </div>
    </div>
  );
}
