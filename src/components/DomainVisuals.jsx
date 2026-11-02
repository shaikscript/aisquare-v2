import React from 'react';
import {
  Film,
  Search,
  Megaphone,
  PlaySquare,
  AudioLines,
  MapPinned,
  Navigation,
} from 'lucide-react';

/**
 * AI Square IT Solutions — Minimal Evaluation Domains
 * Clean, uncluttered role definitions with zero extra domain badges.
 */
export const WORK_DOMAINS = [
  {
    id: 'gen-image-video',
    title: 'Generative Image & Video Grader',
    summary:
      'Grade visual realism, prompt alignment, motion smoothness, and safety across AI-generated imagery and video.',
    Icon: Film,
  },
  {
    id: 'search-engine',
    title: 'Search Engine Evaluator',
    summary:
      'Assess search result helpfulness, factual grounding, freshness, and query intent satisfaction.',
    Icon: Search,
  },
  {
    id: 'online-ads',
    title: 'Online Ads Assessor',
    summary:
      'Review commercial relevance, query alignment, and landing experience quality across digital placements.',
    Icon: Megaphone,
  },
  {
    id: 'media-search',
    title: 'Media Search Analyst',
    summary:
      'Verify discovery accuracy across music, film, podcasts, and app store search queries.',
    Icon: PlaySquare,
  },
  {
    id: 'audio-transcriber',
    title: 'Audio Transcriber & Grader',
    summary:
      'Transcribe spoken utterances and evaluate AI voice naturalness, pronunciation, and pacing.',
    Icon: AudioLines,
  },
  {
    id: 'poi-validator',
    title: 'POI (Point of Interest) Validator',
    summary:
      'Validate real-world business listings, categories, operating hours, and official addresses.',
    Icon: MapPinned,
  },
  {
    id: 'local-map-evaluator',
    title: 'Local Search Map Evaluator',
    summary:
      'Evaluate geographic search results, map pin coordinates, proximity ranking, and route accuracy.',
    Icon: Navigation,
  },
];

export function DomainEmblem({ id, size = 38 }) {
  const found = WORK_DOMAINS.find((d) => d.id === id) || WORK_DOMAINS[0];
  const Icon = found.Icon;
  return (
    <span
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.26),
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(255, 255, 255, 0.05)',
        border: '1px solid rgba(255, 255, 255, 0.13)',
        color: '#ffffff',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.45)} strokeWidth={1.65} />
    </span>
  );
}

export function DomainStageGraphic({ domain }) {
  const active = domain || WORK_DOMAINS[0];
  const Icon = active.Icon;
  return (
    <div
      style={{
        padding: 24,
        borderRadius: 14,
        background: 'rgba(13, 13, 17, 0.7)',
        border: '1px solid rgba(255,255,255,0.1)',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      <Icon size={22} color="#ffffff" />
      <div style={{ fontWeight: 500, fontSize: '1.02rem', color: '#ffffff' }}>{active.title}</div>
      <div style={{ fontSize: '0.86rem', color: '#9a9a9a' }}>{active.summary}</div>
    </div>
  );
}
