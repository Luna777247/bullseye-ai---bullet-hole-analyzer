import { AnalysisResult } from "../types";

const apiBaseUrl = (import.meta as any).env?.VITE_API_BASE_URL ?? '';
const buildApiUrl = (path: string) => `${apiBaseUrl}${path}`;

const checkHealth = async () => {
  const healthUrl = buildApiUrl('/health');
  const res = await fetch(healthUrl, { method: 'GET' });
  if (!res.ok) {
    throw new Error(`Health check failed (${res.status})`);
  }
};

export const analyzeBulletHoles = async (base64Image: string): Promise<AnalysisResult> => {
  // Check server health first for clearer errors
  try {
    await checkHealth();
  } catch (err) {
    throw new Error('Server is offline or unreachable. Start the C++ server on port 8080.');
  }

  // Convert base64 to blob
  const base64Data = base64Image.split(',')[1];
  const byteCharacters = atob(base64Data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  const blob = new Blob([byteArray], { type: 'image/jpeg' });

  const apiUrl = buildApiUrl('/detect');
  console.log('API URL:', apiUrl);

  // Send to API
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/octet-stream',
    },
    body: blob,
  });

  if (!response.ok) {
    if (response.status === 405) {
      throw new Error('API responded 405 (Method Not Allowed). Make sure the frontend is sending POST to /detect.');
    }
    let message = response.statusText || 'Unknown error';
    try {
      const errJson = await response.json();
      if (errJson?.error) {
        message = errJson.error;
      }
    } catch {
      // ignore JSON parse errors
    }
    throw new Error(`API request failed (${response.status}): ${message}`);
  }

  const data = await response.json();

  // Transform API response to AnalysisResult format
  const shots = data.coordinates.map((coord: any, index: number) => ({
    id: index + 1,
    x: (coord.x / data.imageWidth) * 100, // Normalize to 0-100
    y: (coord.y / data.imageHeight) * 100, // Normalize to 0-100
    confidence: 0.95, // High confidence from CV algorithm
    isOverlapping: coord.radius > 18, // Consider larger radius as potential overlap
    radius: coord.radius, // Actual radius from OpenCV detection
  }));

  return {
    totalShots: data.count,
    summary: `Detected ${data.count} bullet holes using Distance Transform + Watershed segmentation. Image size: ${data.imageWidth}x${data.imageHeight}px. Area thresholds: ${data.areaThresholds.min}-${data.areaThresholds.max} pixels.`,
    shots,
    technicalDetails: {
      algorithm: 'Distance Transform + Local Maxima + Watershed',
      imageSize: `${data.imageWidth}x${data.imageHeight}`,
      areaThresholds: `${data.areaThresholds.min}-${data.areaThresholds.max} pixels`,
      processingTime: '< 500ms',
    },
  };
};
