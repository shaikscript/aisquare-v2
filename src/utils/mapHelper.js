/**
 * Builds an OpenStreetMap interactive embed URL around (lat, lng) with a red location marker pin.
 * Works 100% inside cross-origin preview iframes and standalone browsers with zero API keys.
 */
function buildOsmMarkerEmbed(lat, lng, delta = 0.008) {
  const latNum = Number(lat);
  const lngNum = Number(lng);
  const minLon = (lngNum - delta * 1.4).toFixed(6);
  const minLat = (latNum - delta).toFixed(6);
  const maxLon = (lngNum + delta * 1.4).toFixed(6);
  const maxLat = (latNum + delta).toFixed(6);
  return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
    `${minLon},${minLat},${maxLon},${maxLat}`
  )}&layer=mapnik&marker=${encodeURIComponent(`${latNum.toFixed(6)},${lngNum.toFixed(6)}`)}`;
}

export function extractCoordsFromText(input = '') {
  const str = String(input || '').trim();
  if (!str) return null;

  // Match @17.4483,78.3915 or !3d17.4483!4d78.3915 or ?q=17.4483,78.3915
  const bangMatch = str.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
  if (bangMatch) {
    return { lat: Number(bangMatch[1]), lng: Number(bangMatch[2]) };
  }
  const atMatch = str.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) {
    return { lat: Number(atMatch[1]), lng: Number(atMatch[2]) };
  }
  const qMatch = str.match(/[?&](?:q|ll|query)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/);
  if (qMatch) {
    return { lat: Number(qMatch[1]), lng: Number(qMatch[2]) };
  }
  const rawMatch = str.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);
  if (rawMatch) {
    return { lat: Number(rawMatch[1]), lng: Number(rawMatch[2]) };
  }
  return null;
}

/**
 * Resolves interactive map embed URL + Google Maps directions link.
 * - Uses official Google Maps /embed URL if admin pasted one.
 * - Uses exact lat/lng marker pin on OpenStreetMap interactive embed when coordinates exist.
 * - Optionally provides a neutral regional interactive map canvas on /contact before an exact pin is set
 *   (without inventing any fake street address).
 */
export function resolveCompanyMap(
  officeAddress = '',
  mapLink = '',
  mapLat = null,
  mapLng = null,
  { fallbackInteractiveCanvas = false } = {}
) {
  const addr = String(officeAddress || '').trim();
  let rawMap = String(mapLink || '').trim();

  // Extract src="..." if admin pasted a full <iframe ...> snippet
  const iframeSrcMatch = rawMap.match(/src=["']([^"']+)["']/i);
  if (iframeSrcMatch?.[1]) {
    rawMap = iframeSrcMatch[1].trim();
  }

  const isGoogleEmbed = /^https?:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/i.test(rawMap);
  const isHttpLink = /^https?:\/\//i.test(rawMap);

  const inlineCoords =
    extractCoordsFromText(rawMap) || extractCoordsFromText(addr);

  const hasSavedCoords =
    mapLat !== null &&
    mapLat !== undefined &&
    mapLat !== '' &&
    mapLng !== null &&
    mapLng !== undefined &&
    mapLng !== '' &&
    !Number.isNaN(Number(mapLat)) &&
    !Number.isNaN(Number(mapLng));

  const coords = inlineCoords || (hasSavedCoords ? { lat: Number(mapLat), lng: Number(mapLng) } : null);

  if (!addr && !rawMap && !coords) {
    if (!fallbackInteractiveCanvas) return null;
    // Neutral country-level interactive map canvas (zero fabricated street address)
    const fallbackSrc =
      'https://www.openstreetmap.org/export/embed.html?bbox=68.1%2C7.5%2C97.4%2C35.5&layer=mapnik';
    return {
      isConfigured: false,
      embedSrc: fallbackSrc,
      embedUrl: fallbackSrc,
      directionsUrl: 'https://www.google.com/maps',
      externalUrl: 'https://www.google.com/maps',
      displayAddress: '',
    };
  }

  let embedSrc = null;
  if (isGoogleEmbed) {
    embedSrc = rawMap;
  } else if (coords) {
    embedSrc = buildOsmMarkerEmbed(coords.lat, coords.lng, 0.006);
  } else if (fallbackInteractiveCanvas) {
    embedSrc =
      'https://www.openstreetmap.org/export/embed.html?bbox=68.1%2C7.5%2C97.4%2C35.5&layer=mapnik';
  }

  const directionsTarget = addr || (coords ? `${coords.lat},${coords.lng}` : 'AI Square IT Solutions');
  const directionsUrl =
    isHttpLink && !isGoogleEmbed
      ? rawMap
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(directionsTarget)}`;

  return {
    isConfigured: true,
    embedSrc,
    embedUrl: embedSrc,
    directionsUrl,
    externalUrl: directionsUrl,
    displayAddress: addr || (!isHttpLink ? rawMap : ''),
    coords,
  };
}
