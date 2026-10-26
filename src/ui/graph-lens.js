import { buildKnowledgeGraph } from '../core/relations.js';

/**
 * Prepares mathematical graph topology and metrics from workspace records.
 */
export function prepareGraphTopology(records = [], { maxTimestamp = Infinity } = {}) {
  let minTime = Infinity;
  let maxTime = -Infinity;

  for (const r of records) {
    const t = new Date(r.updatedAt || r.createdAt || Date.now()).getTime();
    if (Number.isFinite(t)) {
      if (t < minTime) minTime = t;
      if (t > maxTime) maxTime = t;
    }
  }

  if (!Number.isFinite(minTime)) {
    minTime = Date.now();
    maxTime = Date.now();
  }

  // Filter records by maxTimestamp
  const activeRecords = records.filter((r) => {
    const t = new Date(r.updatedAt || r.createdAt || Date.now()).getTime();
    return !Number.isFinite(t) || t <= maxTimestamp;
  });

  const kg = buildKnowledgeGraph(activeRecords);
  const recordMap = new Map(activeRecords.map((r) => [r.id, r]));

  const nodes = [];
  const edges = [];
  const brokenTargets = [];

  for (const record of activeRecords) {
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
      updatedAt: record.updatedAt || record.createdAt || null,
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
    minTime,
    maxTime,
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
  let currentRecords = records;
  const canvas = document.createElement('canvas');
  canvas.className = 'topology-canvas';
  canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-label', 'Knowledge Topology Observatory Constellation Map');
  container.appendChild(canvas);

  const hud = document.createElement('div');
  hud.className = 'topology-hud';
  hud.hidden = true;
  container.appendChild(hud);

  const scrubberBar = document.createElement('div');
  scrubberBar.className = 'topology-scrubber-bar';
  scrubberBar.innerHTML = `
    <div class="scrub-header-row">
      <span class="scrub-title">CHRONOLOGICAL EMERGENCE</span>
      <span class="scrub-epoch" id="topo-epoch-label">Present (All Time)</span>
    </div>
    <div class="scrub-controls-row">
      <button type="button" class="button button-quiet scrub-btn" id="topo-play-btn" title="Replay time-lapse emergence">▶ Replay</button>
      <input type="range" class="topo-slider" id="topo-scrub-slider" min="0" max="100" value="100" aria-label="Chronological slider">
    </div>
  `;
  container.appendChild(scrubberBar);

  let topology = prepareGraphTopology(currentRecords);
  let currentMaxTime = Infinity;
  let activeTopology = topology;

  let nodes = topology.nodes.map((n, idx) => {
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

  let nodeMap = new Map(nodes.map((n) => [n.id, n]));
  let animId = null;
  let playInterval = null;
  let hoveredNode = null;
  let width = 0;
  let height = 0;

  const slider = scrubberBar.querySelector('#topo-scrub-slider');
  const epochLabel = scrubberBar.querySelector('#topo-epoch-label');
  const playBtn = scrubberBar.querySelector('#topo-play-btn');

  function updateEpoch(pct) {
    if (pct >= 100) {
      currentMaxTime = Infinity;
      epochLabel.textContent = 'Present (All Time)';
      activeTopology = topology;
    } else {
      const range = Math.max(1000, topology.maxTime - topology.minTime);
      currentMaxTime = topology.minTime + (pct / 100) * range;
      const d = new Date(currentMaxTime);
      epochLabel.textContent = `Epoch: ${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}`;
      activeTopology = prepareGraphTopology(currentRecords, { maxTimestamp: currentMaxTime });
    }
    draw();
  }

  slider.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    audioFeedback?.scrub();
    updateEpoch(val);
  });

  playBtn.addEventListener('click', () => {
    if (playInterval) {
      clearInterval(playInterval);
      playInterval = null;
      playBtn.textContent = '▶ Replay';
      return;
    }
    playBtn.textContent = '⏸ Pause';
    slider.value = '0';
    updateEpoch(0);
    audioFeedback?.shutter();

    let step = 0;
    playInterval = setInterval(() => {
      step += 2;
      slider.value = String(step);
      if (step % 10 === 0) audioFeedback?.scrub();
      updateEpoch(step);
      if (step >= 100) {
        clearInterval(playInterval);
        playInterval = null;
        playBtn.textContent = '▶ Replay';
        audioFeedback?.commit();
      }
    }, 50);
  });

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

    const activeNodeIds = new Set(activeTopology.nodes.map((n) => n.id));
    const activeEdgeSet = new Set(activeTopology.edges.map((e) => `${e.source}->${e.target}`));

    // Draw Edges
    for (const edge of topology.edges) {
      if (!activeEdgeSet.has(`${edge.source}->${edge.target}`)) continue;
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
      const isActive = activeNodeIds.has(n.id);
      if (!isActive) {
        // Render unformed/future ghost outline
        ctx.beginPath();
        ctx.arc(n.x, n.y, Math.max(3, n.radius * 0.5), 0, Math.PI * 2);
        ctx.fillStyle = '#0a1017';
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#14202d';
        ctx.stroke();
        continue;
      }

      const isHovered = hoveredNode && hoveredNode.id === n.id;
      const isNeighbor = hoveredNode && activeTopology.edges.some(
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
      if (n.radius >= 10 || isHovered || isNeighbor || activeTopology.nodes.length <= 15) {
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

    const activeNodeIds = new Set(activeTopology.nodes.map((n) => n.id));
    let found = null;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const n = nodes[i];
      if (!activeNodeIds.has(n.id)) continue;
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
      if (playInterval) clearInterval(playInterval);
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('click', handleClick);
      if (animId) cancelAnimationFrame(animId);
      container.innerHTML = '';
    },
    update(newRecords) {
      if (playInterval) {
        clearInterval(playInterval);
        playInterval = null;
        if (playBtn) playBtn.textContent = '▶ Replay';
      }
      currentRecords = newRecords;
      topology = prepareGraphTopology(currentRecords);
      activeTopology = topology;
      if (slider) slider.value = '100';
      if (epochLabel) epochLabel.textContent = 'Present (All Time)';
      nodes = topology.nodes.map((n, idx) => {
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
      nodeMap = new Map(nodes.map((n) => [n.id, n]));
      resize();
      draw();
    },
  };
}
