import { CATEGORY_LIST } from './constants';

export type AIAnalysisResult = {
  suggested_category: string;
  confidence: number;
  priority_score: number;
  priority_label: string;
  priority_factors: {
    urgency: number;
    impact: number;
    recurrence: number;
    vulnerability: number;
  };
  explanation: string;
  duplicate_keywords: string[];
  ai_powered?: boolean;
  model_version?: string;
};

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Water Supply': ['water', 'pipe', 'tap', 'leak', 'supply', 'pressure', 'tank', 'drinking', 'burst', 'dry', 'flow'],
  'Garbage Overflow': ['garbage', 'trash', 'waste', 'bin', 'overflow', 'dump', 'rubbish', 'litter', 'collection', 'smell', 'rotting'],
  'Damaged Road': ['road', 'pothole', 'crack', 'damage', 'surface', 'asphalt', 'pavement', 'broken', 'hole', 'speed breaker'],
  'Drainage Problem': ['drain', 'drainage', 'flood', 'waterlog', 'block', 'overflow', 'sewer', 'storm', 'monsoon', 'clog'],
  'Streetlight Failure': ['streetlight', 'light', 'lamp', 'dark', 'pole', 'flicker', 'bulb', 'illumination', 'night', 'outage'],
  'Public Transport': ['bus', 'transport', 'route', 'shelter', 'stop', 'schedule', 'delay', 'service', 'transit', 'fare'],
};

const URGENCY_KEYWORDS = ['urgent', 'emergency', 'danger', 'immediate', 'critical', 'serious', 'severe', 'safety', 'hazard', 'risk'];
const IMPACT_KEYWORDS = ['many', 'everyone', 'whole', 'entire', 'all', 'community', 'neighborhood', 'street', 'families', 'children'];
const VULNERABILITY_KEYWORDS = ['school', 'hospital', 'elderly', 'children', 'disability', 'disabled', 'clinic', 'pregnant', 'low income', 'slum'];

function countKeywordMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  return keywords.filter((k) => lower.includes(k)).length;
}

function classifyCategory(title: string, description: string): { category: string; confidence: number } {
  const text = `${title} ${description}`.toLowerCase();
  let bestMatch = CATEGORY_LIST[0];
  let bestScore = 0;

  for (const category of CATEGORY_LIST) {
    const keywords = CATEGORY_KEYWORDS[category] || [];
    const matches = countKeywordMatches(text, keywords);
    if (matches > bestScore) {
      bestScore = matches;
      bestMatch = category;
    }
  }

  const confidence = bestScore === 0 ? 0.45 : Math.min(0.55 + bestScore * 0.12, 0.95);
  return { category: bestMatch, confidence };
}

export function analyzeReport(
  title: string,
  description: string,
  locationText: string,
  categoryName: string
): AIAnalysisResult {
  const text = `${title} ${description} ${locationText}`;

  const { category: suggestedCategory, confidence } = classifyCategory(title, description);

  const urgencyMatches = countKeywordMatches(text, URGENCY_KEYWORDS);
  const impactMatches = countKeywordMatches(text, IMPACT_KEYWORDS);
  const vulnerabilityMatches = countKeywordMatches(text, VULNERABILITY_KEYWORDS);

  const urgency = Math.min(30 + urgencyMatches * 20, 100);
  const impact = Math.min(30 + impactMatches * 20, 100);
  const recurrence = 50; // Default, would be based on historical data
  const vulnerability = Math.min(20 + vulnerabilityMatches * 25, 100);

  const priorityScore = Math.round(
    0.4 * urgency + 0.3 * impact + 0.2 * recurrence + 0.1 * vulnerability
  );

  let priorityLabel = 'low';
  if (priorityScore >= 80) priorityLabel = 'critical';
  else if (priorityScore >= 60) priorityLabel = 'high';
  else if (priorityScore >= 40) priorityLabel = 'medium';

  const matchedCategory = suggestedCategory === categoryName;
  const explanationParts: string[] = [];

  if (matchedCategory) {
    explanationParts.push(`AI confirms the category "${categoryName}" with ${Math.round(confidence * 100)}% confidence based on keyword analysis.`);
  } else {
    explanationParts.push(`AI suggests category "${suggestedCategory}" (${Math.round(confidence * 100)}% confidence) based on keyword analysis. The citizen selected "${categoryName}".`);
  }

  explanationParts.push(
    `Priority factors: Urgency ${urgency}/100, Impact ${impact}/100, Recurrence ${recurrence}/100, Vulnerability ${vulnerability}/100.`
  );

  if (urgencyMatches > 0) {
    explanationParts.push(`Urgency keywords detected: ${urgencyMatches}. This may require faster response.`);
  }
  if (vulnerabilityMatches > 0) {
    explanationParts.push(`Vulnerability indicators found near sensitive locations.`);
  }

  const keywords = CATEGORY_KEYWORDS[suggestedCategory] || [];

  return {
    suggested_category: suggestedCategory,
    confidence,
    priority_score: priorityScore,
    priority_label: priorityLabel,
    priority_factors: { urgency, impact, recurrence, vulnerability },
    explanation: explanationParts.join(' '),
    duplicate_keywords: keywords,
  };
}

export function generateTrackingId(): string {
  const timestamp = Date.now().toString(36).toUpperCase().slice(-5);
  const random = Math.random().toString(36).toUpperCase().slice(2, 5);
  return `CP-${timestamp}${random}`;
}

export function calculateSimilarity(
  text1: string,
  text2: string,
  category1: string,
  category2: string
): number {
  if (category1 !== category2) return 0;

  const words1 = new Set(text1.toLowerCase().split(/\s+/).filter((w) => w.length > 3));
  const words2 = new Set(text2.toLowerCase().split(/\s+/).filter((w) => w.length > 3));

  if (words1.size === 0 || words2.size === 0) return 0;

  const intersection = new Set(Array.from(words1).filter((w) => words2.has(w)));
  const union = new Set(Array.from(words1).concat(Array.from(words2)));

  return Math.round((intersection.size / union.size) * 100) / 100;
}
