import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareGraphTopology } from '../src/ui/graph-lens.js';

test('1. prepareGraphTopology extracts nodes, edges, clusters, and broken references', () => {
  const records = [
    { id: 'note:alpha', kind: 'note', title: 'Alpha Spec', body: 'Refers to [[decision:arch]] and [[note:missing]]' },
    { id: 'decision:arch', kind: 'decision', title: 'Local-first Architecture', body: 'Decision body', supersedes: 'decision:old' },
    { id: 'decision:old', kind: 'decision', title: 'Cloud-first Architecture', body: 'Superseded' },
    { id: 'incident:crash', kind: 'incident', title: 'Memory Leak', body: 'Caused by [[note:alpha]]' },
  ];

  const topology = prepareGraphTopology(records);

  assert.equal(topology.nodes.length, 4);
  assert.ok(topology.nodes.find((n) => n.id === 'note:alpha'));
  assert.ok(topology.nodes.find((n) => n.id === 'decision:arch'));

  // Edges
  assert.ok(topology.edges.length >= 3);
  const linkEdge = topology.edges.find((e) => e.source === 'note:alpha' && e.target === 'decision:arch');
  assert.ok(linkEdge);
  assert.equal(linkEdge.type, 'wikilink');

  // Superseding edge
  const superEdge = topology.edges.find((e) => e.source === 'decision:arch' && e.target === 'decision:old');
  assert.ok(superEdge);
  assert.equal(superEdge.type, 'supersedes');

  // Broken reference identified
  assert.ok(topology.brokenTargets.includes('note:missing'));
});

test('2. prepareGraphTopology computes degrees and gravity metrics', () => {
  const records = [
    { id: 'hub', kind: 'project', title: 'Hub Project', body: 'Central' },
    { id: 'leaf1', kind: 'note', title: 'Leaf 1', body: 'Connects to [[hub]]' },
    { id: 'leaf2', kind: 'note', title: 'Leaf 2', body: 'Connects to [[hub]]' },
  ];

  const topology = prepareGraphTopology(records);
  const hubNode = topology.nodes.find((n) => n.id === 'hub');
  assert.equal(hubNode.incomingDegree, 2);
  assert.equal(hubNode.outgoingDegree, 0);
  assert.ok(hubNode.radius > 8); // Hubs have larger radius for visual hierarchy
});

test('3. prepareGraphTopology filters by chronological epoch horizon', () => {
  const records = [
    { id: 'early', kind: 'note', title: 'Genesis Note', updatedAt: '2026-01-01T10:00:00Z' },
    { id: 'mid', kind: 'decision', title: 'Mid Decision', updatedAt: '2026-06-01T10:00:00Z', body: 'Refers to [[early]]' },
    { id: 'late', kind: 'incident', title: 'Late Incident', updatedAt: '2026-10-01T10:00:00Z', body: 'Refers to [[mid]]' },
  ];

  const full = prepareGraphTopology(records);
  assert.equal(full.nodes.length, 3);
  assert.equal(full.minTime, new Date('2026-01-01T10:00:00Z').getTime());
  assert.equal(full.maxTime, new Date('2026-10-01T10:00:00Z').getTime());

  // Scrub back to mid-year
  const midEpoch = new Date('2026-06-15T00:00:00Z').getTime();
  const scrubbed = prepareGraphTopology(records, { maxTimestamp: midEpoch });

  assert.equal(scrubbed.nodes.length, 2);
  assert.ok(scrubbed.nodes.find((n) => n.id === 'early'));
  assert.ok(scrubbed.nodes.find((n) => n.id === 'mid'));
  assert.ok(!scrubbed.nodes.find((n) => n.id === 'late'));
  assert.equal(scrubbed.edges.length, 1);
});
