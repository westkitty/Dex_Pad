import { buildKnowledgeGraph } from '../core/relations.js';

/**
 * Prepares mathematical graph topology and metrics from workspace records.
 */
export function prepareGraphTopology(records = []) {
  const kg = buildKnowledgeGraph(records);
  const recordMap = new Map(records.map((r) => [r.id, r]));

  const nodes = [];
  const edges = [];
  const brokenTargets = [];

  for (const record of records) {
    const outgoing = kg.outgoingMap.get(record.id) || [];
    const incoming = kg.backlinksMap.get(record.id) || [];

    nodes.push({
      id: record.id,
      kind: record.kind || 'note',
      title: record.title || 'Untitled',
      evidenceState: record.evidenceState || 'proposed',
      revision: record.revision || 1,
      incomingDegree: incoming.length,
      outgoingDegree: outgoing.length,
      radius: Math.max(6, Math.min(22, 7 + incoming.length * 3)),
    });

    for (const link of outgoing) {
      if (link.brokenTarget) {
        if (!brokenTargets.includes(link.targetId)) {
          brokenTargets.push(link.targetId);
        }
      } else {
        edges.push({
          source: record.id,
          target: link.targetId,
          type: link.relation || 'wikilink',
        });
      }
    }
  }

  return {
    nodes,
    edges,
    brokenTargets,
    stats: {
      totalNodes: nodes.length,
      totalEdges: edges.length,
      brokenCount: brokenTargets.length,
    },
  };
}

/**
 * Mounts interactive 2D Canvas Knowledge Topology Observatory.
 * Renders dark-field constellation map with crisp vector connections.
 */
export function mountGraphCanvas(container, records, { onSelectNode, audioFeedback } = {}) {
  if (!container || typeof document === 'undefined') {
    return { destroy() {} };
  }

  container.innerHTML = '';
  const canvas = document.createElement('canvas');
  canvas.className = 'topology-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Knowledge Topology Observatory Constellation Map');
  container.appendChild(canvas);

  const hud = document.createElement('div');
  hud.className = 'topology-hud';
  hud.hidden = true;
  container.appendChild(hud);

  const topology = prepareGraphTopology(records);
  const nodes = topology.nodes.map((n, idx) => {
    // Deterministic golden spiral initial distribution
    const phi = idx * 2.3999632;
    const dist = 50 + Math.sqrt(idx) * 45;
    return {
      ...n,
      x: 0,
      y: 0,
      baseDist: dist,
      angle: phi,
      hovered: false,
    };
  });

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let animId = null;
  let hoveredNode = null;
  let width = 0;
  let height = 0;

  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width || 600;
    height = rect.height || 450;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const cx = width / 2;
    const cy = height / 2;

    for (const n of nodes) {
      n.x = cx + Math.cos(n.angle) * Math.min(n.baseDist, width * 0.42);
      n.y = cy + Math.sin(n.angle) * Math.min(n.baseDist, height * 0.42);
    }
  }

  function getNodeColor(kind) {
    switch (kind) {
      case 'decision': return '#f0c078';
      case 'project': return '#6b9ae8';
      case 'incident': return '#f09b9b';
      case 'commitment': return '#82c9a6';
      default: return '#8bc4ff';
    }
  }

  function draw() {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, width, height);

    // Faint grid dots
    ctx.fillStyle = '#182436';
    const step = 40;
    for (let gx = step; gx < width; gx += step) {
      for (let gy = step; gy < height; gy += step) {
        ctx.fillRect(gx, gy, 1.5, 1.5);
      }
    }

    // Draw Edges
    for (const edge of topology.edges) {
      const src = nodeMap.get(edge.source);
      const tgt = nodeMap.get(edge.target);
      if (!src || !tgt) continue;

      const isConnectedToHover = hoveredNode && (hoveredNode.id === src.id || hoveredNode.id === tgt.id);

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);

      if (edge.type === 'supersedes') {
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = isConnectedToHover ? '#ffd488' : '#6b4f24';
        ctx.lineWidth = isConnectedToHover ? 2 : 1.2;
      } else {
        ctx.setLineDash([]);
        ctx.strokeStyle = isConnectedToHover ? '#8dc4ff' : '#22384e';
        ctx.lineWidth = isConnectedToHover ? 1.8 : 1;
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Draw Nodes
    for (const n of nodes) {
      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const isNeighbor = hoveredNode && topology.edges.some(
        (e) => (e.source === hoveredNode.id && e.target === n.id) || (e.target === hoveredNode.id && e.source === n.id)
      );

      const color = getNodeColor(n.kind);

      // Outer glow for hovered
      if (isHovered) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.radius + 6, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(139, 196, 255, 0.15)';
        ctx.fill();
      }

      // Main node body
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.radius, 0, Math.PI * 2);
      ctx.fillStyle = isHovered || isNeighbor ? '#ffffff' : color;
      ctx.fill();

      ctx.lineWidth = isHovered ? 2.5 : 1.5;
      ctx.strokeStyle = color;
      ctx.stroke();

      // Node Label
      if (n.radius >= 10 || isHovered || isNeighbor || nodes.length <= 15) {
        ctx.font = isHovered ? 'bold 11px ui-monospace, monospace' : '10px ui-sans-serif, sans-serif';
        ctx.fillStyle = isHovered ? '#ffffff' : '#9bb2ce';
        ctx.textAlign = 'center';
        const label = n.title.length > 16 ? n.title.slice(0, 15) + '…' : n.title;
        ctx.fillText(label, n.x, n.y + n.radius + 13);
      }
    }

    ctx.restore();
  }

  function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let found = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      const dx = mx - n.x;
      const dy = my - n.y;
      if (dx * dx + dy * dy <= (n.radius + 5) * (n.radius + 5)) {
        found = n;
        break;
      }
    }

    if (found !== hoveredNode) {
      hoveredNode = found;
      if (hoveredNode) {
        canvas.style.cursor = 'pointer';
        audioFeedback?.tick();
        hud.hidden = false;
        hud.style.left = `${Math.min(width - 240, Math.max(10, hoveredNode.x + 15))}px`;
        hud.style.top = `${Math.min(height - 100, Math.max(10, hoveredNode.y - 20))}px`;
        hud.innerHTML = `
          <div class="hud-tag">${hoveredNode.kind.toUpperCase()}</div>
          <div class="hud-title">${escapeHtml(hoveredNode.title)}</div>
          <div class="hud-meta">
            <span>Rev ${hoveredNode.revision}</span> &bull; 
            <span>${hoveredNode.incomingDegree} in / ${hoveredNode.outgoingDegree} out</span> &bull; 
            <span class="hud-state">${hoveredNode.evidenceState}</span>
          </div>
        `;
      } else {
        canvas.style.cursor = 'default';
        hud.hidden = true;
      }
      draw();
    }
  }

  function handleClick(e) {
    if (hoveredNode && onSelectNode) {
      audioFeedback?.commit();
      onSelectNode(hoveredNode.id);
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  window.addEventListener('resize', resize);
  canvas.addEventListener('mousemove', handleMouseMove);
  canvas.addEventListener('click', handleClick);

  resize();
  draw();

  return {
    destroy() {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      if (animId) cancelAnimationFrame(animId);
      container.innerHTML = '';
    },
    update(newRecords) {
      // Refresh topology
      const newTopology = prepareGraphTopology(newRecords);
      // Re-mount
      resize();
      draw();
    },
  };
}
