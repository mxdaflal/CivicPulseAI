const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const CATEGORIES = [
  "Water Supply",
  "Garbage Overflow",
  "Damaged Road",
  "Drainage Problem",
  "Streetlight Failure",
  "Public Transport",
];

interface AnalysisRequest {
  title: string;
  description: string;
  locationText: string;
  categoryName: string;
}

interface AIResult {
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
  model_version: string;
  ai_powered: boolean;
}

function fallbackAnalysis(req: AnalysisRequest): AIResult {
  const text = `${req.title} ${req.description} ${req.locationText}`.toLowerCase();

  const urgencyKeywords = ["urgent", "emergency", "danger", "immediate", "critical", "serious", "severe", "safety", "hazard", "risk"];
  const impactKeywords = ["many", "everyone", "whole", "entire", "all", "community", "neighborhood", "street", "families", "children"];
  const vulnerabilityKeywords = ["school", "hospital", "elderly", "children", "disability", "disabled", "clinic", "pregnant", "low income", "slum"];

  const urgencyMatches = urgencyKeywords.filter((k) => text.includes(k)).length;
  const impactMatches = impactKeywords.filter((k) => text.includes(k)).length;
  const vulnerabilityMatches = vulnerabilityKeywords.filter((k) => text.includes(k)).length;

  const urgency = Math.min(30 + urgencyMatches * 20, 100);
  const impact = Math.min(30 + impactMatches * 20, 100);
  const recurrence = 50;
  const vulnerability = Math.min(20 + vulnerabilityMatches * 25, 100);

  const priorityScore = Math.round(
    0.4 * urgency + 0.3 * impact + 0.2 * recurrence + 0.1 * vulnerability
  );

  let priorityLabel = "low";
  if (priorityScore >= 80) priorityLabel = "critical";
  else if (priorityScore >= 60) priorityLabel = "high";
  else if (priorityScore >= 40) priorityLabel = "medium";

  const categoryKeywords: Record<string, string[]> = {
    "Water Supply": ["water", "pipe", "tap", "leak", "supply", "pressure", "tank", "burst", "dry"],
    "Garbage Overflow": ["garbage", "trash", "waste", "bin", "overflow", "dump", "rubbish", "litter"],
    "Damaged Road": ["road", "pothole", "crack", "damage", "surface", "asphalt", "pavement", "broken"],
    "Drainage Problem": ["drain", "drainage", "flood", "waterlog", "block", "sewer", "storm", "clog"],
    "Streetlight Failure": ["streetlight", "light", "lamp", "dark", "pole", "flicker", "bulb", "outage"],
    "Public Transport": ["bus", "transport", "route", "shelter", "stop", "schedule", "delay", "transit"],
  };

  return {
    suggested_category: req.categoryName,
    confidence: 0.6,
    priority_score: priorityScore,
    priority_label: priorityLabel,
    priority_factors: { urgency, impact, recurrence, vulnerability },
    explanation: `Offline analysis: Category confirmed as "${req.categoryName}". Priority factors: Urgency ${urgency}/100, Impact ${impact}/100, Recurrence ${recurrence}/100, Vulnerability ${vulnerability}/100. ${urgencyMatches > 0 ? "Urgency keywords detected. " : ""}${vulnerabilityMatches > 0 ? "Vulnerability indicators found." : ""}`,
    duplicate_keywords: categoryKeywords[req.categoryName] || [],
    model_version: "fallback-v1",
    ai_powered: false,
  };
}

async function openAIAnalysis(req: AnalysisRequest): Promise<AIResult> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) {
    return fallbackAnalysis(req);
  }

  const systemPrompt = `You are an AI analyst for CIVIC PULSE AI, a civic incident intelligence platform.
Analyze the following citizen report about a public-service problem.

Your task:
1. Confirm or suggest the correct category from: ${CATEGORIES.join(", ")}
2. Assess priority using four factors (each 0-100):
   - Urgency: How time-sensitive is this? (water contamination = high, minor crack = low)
   - Impact: How many people are affected? (entire neighborhood = high, single home = low)
   - Recurrence: Is this a recurring pattern? (use 50 as default if unknown)
   - Vulnerability: Are vulnerable populations nearby? (schools, hospitals, elderly = high)
3. Calculate overall priority: P = 0.40*Urgency + 0.30*Impact + 0.20*Recurrence + 0.10*Vulnerability
4. Assign priority label: critical (>=80), high (>=60), medium (>=40), low (<40)
5. Extract keywords useful for duplicate detection
6. Write a clear, concise explanation of your reasoning

Respond ONLY with valid JSON in this exact format:
{
  "suggested_category": "one of the categories",
  "confidence": 0.0-1.0,
  "priority_factors": { "urgency": 0-100, "impact": 0-100, "recurrence": 0-100, "vulnerability": 0-100 },
  "priority_score": 0-100,
  "priority_label": "critical|high|medium|low",
  "explanation": "2-3 sentences explaining the analysis",
  "duplicate_keywords": ["keyword1", "keyword2", ...]
}`;

  const userPrompt = `Report:
- Title: ${req.title}
- Category (citizen-selected): ${req.categoryName}
- Description: ${req.description}
- Location: ${req.locationText || "Not specified"}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`OpenAI API error ${response.status}: ${errText}`);
    return fallbackAnalysis(req);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return fallbackAnalysis(req);
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    return fallbackAnalysis(req);
  }

  const categoryKeywords: Record<string, string[]> = {
    "Water Supply": ["water", "pipe", "tap", "leak", "supply", "pressure", "tank", "burst"],
    "Garbage Overflow": ["garbage", "trash", "waste", "bin", "overflow", "dump", "rubbish"],
    "Damaged Road": ["road", "pothole", "crack", "damage", "surface", "asphalt", "pavement"],
    "Drainage Problem": ["drain", "drainage", "flood", "waterlog", "block", "sewer", "clog"],
    "Streetlight Failure": ["streetlight", "light", "lamp", "dark", "pole", "flicker", "bulb"],
    "Public Transport": ["bus", "transport", "route", "shelter", "stop", "schedule", "delay"],
  };

  const suggestedCategory = CATEGORIES.includes(parsed.suggested_category)
    ? parsed.suggested_category
    : req.categoryName;

  const factors = parsed.priority_factors || { urgency: 50, impact: 50, recurrence: 50, vulnerability: 20 };

  return {
    suggested_category: suggestedCategory,
    confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : 0.75,
    priority_score: typeof parsed.priority_score === "number" ? parsed.priority_score : 50,
    priority_label: ["critical", "high", "medium", "low"].includes(parsed.priority_label) ? parsed.priority_label : "medium",
    priority_factors: {
      urgency: factors.urgency ?? 50,
      impact: factors.impact ?? 50,
      recurrence: factors.recurrence ?? 50,
      vulnerability: factors.vulnerability ?? 20,
    },
    explanation: typeof parsed.explanation === "string" ? parsed.explanation : "AI analysis completed.",
    duplicate_keywords: Array.isArray(parsed.duplicate_keywords) ? parsed.duplicate_keywords : (categoryKeywords[suggestedCategory] || []),
    model_version: "openai-gpt-4o-mini-v1",
    ai_powered: true,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body: AnalysisRequest = await req.json();

    if (!body.title || !body.description || !body.categoryName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: title, description, categoryName" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await openAIAnalysis(body);

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
