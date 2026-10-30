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
 * AI Square IT Solutions — Core iOS & Android AI Evaluation Tracks
 * 100% career & vision focused (zero client/sales copy, zero auto-cycling slideshows).
 */
export const WORK_DOMAINS = [
  {
    id: 'gen-image-video',
    code: '01',
    platform: 'iOS & Android',
    title: 'Generative Image & Video Grader',
    tagline: 'Visual Fidelity & Prompt Alignment',
    summary:
      'Evaluate AI-generated images and short-form video clips for prompt adherence, visual realism, temporal smoothness, and safety standards across mobile surfaces.',
    highlights: [
      'Side-by-side generative image & video quality ranking',
      'Artifact, motion-coherence & anatomical accuracy checks',
      'Safety, policy & prompt-faithfulness rubric scoring',
    ],
    Icon: Film,
  },
  {
    id: 'search-engine',
    code: '02',
    platform: 'iOS & Android',
    title: 'Search Engine Evaluator',
    tagline: 'Mobile Query Intent & Relevance',
    summary:
      'Assess search result helpfulness, factual grounding, freshness, and query intent satisfaction for mobile and voice-initiated search queries.',
    highlights: [
      'User intent classification across mobile queries',
      'Result relevance, authority & freshness verification',
      'AI-generated search summary factuality checks',
    ],
    Icon: Search,
  },
  {
    id: 'online-ads',
    code: '03',
    platform: 'iOS & Android',
    title: 'Online Ads Assessor',
    tagline: 'Ad Relevance & User Experience',
    summary:
      'Review mobile search, feed, and app-store advertisements to ensure strong alignment with user queries, clear landing experiences, and policy compliance.',
    highlights: [
      'Query-to-ad relevance & intent matching on mobile',
      'Landing page clarity & app install experience review',
      'Misleading claim & content policy screening',
    ],
    Icon: Megaphone,
  },
  {
    id: 'media-search',
    code: '04',
    platform: 'iOS & Android',
    title: 'Media Search Analyst',
    tagline: 'Music, Video, Podcast & App Discovery',
    summary:
      'Verify accuracy and ranking quality across mobile media ecosystems — including music, movies, TV shows, podcasts, and app store search queries.',
    highlights: [
      'Title, artist, genre & natural-language media lookups',
      'iOS & Android app-discovery relevance evaluation',
      'Cross-locale catalog & entity disambiguation',
    ],
    Icon: PlaySquare,
  },
  {
    id: 'audio-transcriber',
    code: '05',
    platform: 'iOS & Android',
    title: 'Audio Transcriber & Grader',
    tagline: 'Speech Recognition & Voice AI Quality',
    summary:
      'Transcribe spoken utterances and grade AI voice outputs for pronunciation, naturalness, pacing, tone, and acoustic accuracy on mobile devices.',
    highlights: [
      'Utterance transcription & timestamp verification',
      'TTS voice naturalness, prosody & pronunciation grading',
      'Wake-word & noisy-environment speech evaluation',
    ],
    Icon: AudioLines,
  },
  {
    id: 'poi-validator',
    code: '06',
    platform: 'iOS & Android',
    title: 'POI (Point of Interest) Validator',
    tagline: 'Real-World Place & Entity Verification',
    summary:
      'Research and validate real-world business listings, categories, operating hours, addresses, and storefront details powering mobile map ecosystems.',
    highlights: [
      'Business existence, category & address verification',
      'Duplicate POI detection & official metadata cleanup',
      'Storefront imagery & official web cross-checking',
    ],
    Icon: MapPinned,
  },
  {
    id: 'local-map-evaluator',
    code: '07',
    platform: 'iOS & Android',
    title: 'Local Search Map Evaluator',
    tagline: 'Navigation, Pin Accuracy & Local Ranking',
    summary:
      'Evaluate geographic search results, map pin placement, distance relevance, and routing quality for on-the-go iOS and Android users.',
    highlights: [
      'Rooftop map-pin precision & entry-point validation',
      'Viewport, proximity & local intent ranking review',
      ' Regional address formatting & route sanity checks',
    ],
    Icon: Navigation,
  },
];

export function DomainEmblem({ id, size = 40 }) {
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
        background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.03))',
        border: '1px solid rgba(255, 255, 255, 0.16)',
        color: '#ffffff',
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <Icon size={Math.round(size * 0.46)} strokeWidth={1.75} />
    </span>
  );
}

export function DomainStageGraphic({ domain }) {
  const active = domain || WORK_DOMAINS[0];
  const Icon = active.Icon;
  return (
    <div
      style={{
        padding: 28,
        borderRadius: 16,
        background: '#0d0d10',
        border: '1px solid rgba(255,255,255,0.12)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Icon size={24} color="#ffffff" />
        <span style={{ fontSize: '0.75rem', color: '#9a9a9a' }}>{active.platform}</span>
      </div>
      <div style={{ fontWeight: 600, fontSize: '1.05rem', color: '#ffffff' }}>{active.title}</div>
      <div style={{ fontSize: '0.86rem', color: '#9a9a9a' }}>{active.tagline}</div>
    </div>
  );
}
