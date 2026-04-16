import Groq from 'groq-sdk';
import crypto from 'crypto';
import { getCache, setCache } from './redis';

export const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Model config
export const GROQ_MODELS = {
  fast: 'llama-3.1-8b-instant',
  smart: 'llama-3.3-70b-versatile',
} as const;

// Hash project description for cache key
function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

// ── Project Analysis ──────────────────────────────────────────────────────────
export interface AnalysisResult {
  recommendedStructure: string[];
  biddingStrategy: 'fixed' | 'hourly' | 'milestone';
  effortLevel: 'low' | 'medium' | 'high';
  hoursEstimate: number;
  techFitScore: number;
  matchedSkills: string[];
  bidRange: { min: number; max: number; currency: string };
  redFlags: string[];
  winningAngle: string;
}

export async function analyzeProject(
  projectTitle: string,
  projectDescription: string,
  userSkills: string[],
  hourlyRate: number,
  clientCountry = 'Unknown',
): Promise<AnalysisResult> {
  const cacheKey = `ai:analysis:${hashText(projectTitle + projectDescription)}`;
  const cached = await getCache<AnalysisResult>(cacheKey);
  if (cached) return cached;

  const systemPrompt = `You are an expert freelance consultant and proposal strategist with 10+ years of experience on Upwork, Toptal, and Freelancer.com. Analyze the given project and return a structured JSON assessment that helps the freelancer craft a winning proposal. Always respond with valid JSON only, no markdown.`;

  const userPrompt = `Analyze this freelance project and return JSON:

Project Title: ${projectTitle}
Project Description: ${projectDescription}
Client Country: ${clientCountry}
Freelancer Skills: ${userSkills.join(', ')}
Freelancer Hourly Rate: $${hourlyRate}/hr

Return this exact JSON structure:
{
  "recommendedStructure": ["section1", "section2", ...],
  "biddingStrategy": "fixed" | "hourly" | "milestone",
  "effortLevel": "low" | "medium" | "high",
  "hoursEstimate": number,
  "techFitScore": 0-100,
  "matchedSkills": ["skill1", ...],
  "bidRange": { "min": number, "max": number, "currency": "USD" },
  "redFlags": ["flag1", ...],
  "winningAngle": "single best USP string"
}`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODELS.smart,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1024,
  });

  const text = completion.choices[0]?.message?.content || '{}';
  let result: AnalysisResult;

  try {
    result = JSON.parse(text) as AnalysisResult;
  } catch {
    result = {
      recommendedStructure: ['Hook', 'Solution', 'Experience', 'Timeline', 'CTA'],
      biddingStrategy: 'fixed',
      effortLevel: 'medium',
      hoursEstimate: 40,
      techFitScore: 70,
      matchedSkills: userSkills.slice(0, 3),
      bidRange: { min: hourlyRate * 20, max: hourlyRate * 60, currency: 'USD' },
      redFlags: [],
      winningAngle: 'Deliver high-quality results on time.',
    };
  }

  await setCache(cacheKey, result, 3600);
  return result;
}

// ── Proposal Generation ───────────────────────────────────────────────────────
export async function generateProposal(
  projectTitle: string,
  projectDescription: string,
  analysis: AnalysisResult,
  userName: string,
  userBio: string,
  strategy: string,
): Promise<string> {
  const systemPrompt = `You are an expert freelance proposal writer. Write compelling, personalized proposals that win jobs. Be concise, confident, and client-focused.`;

  const userPrompt = `Write a freelance proposal for this project:

Project: ${projectTitle}
Description: ${projectDescription}
Strategy: ${strategy}
Winning Angle: ${analysis.winningAngle}
Recommended Structure: ${analysis.recommendedStructure.join(' → ')}
Bidding Strategy: ${analysis.biddingStrategy}

Freelancer Info:
Name: ${userName}
Bio: ${userBio}

Write a complete, professional proposal following the recommended structure. Be specific to the project. Keep it under 350 words.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODELS.smart,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: 0.7,
    max_tokens: 1024,
  });

  return completion.choices[0]?.message?.content || '';
}

// ── Profile Review ────────────────────────────────────────────────────────────
export interface ProfileReviewResult {
  overallScore: number;
  dimensionScores: {
    headline: number;
    bio: number;
    skills: number;
    portfolio: number;
    completeness: number;
  };
  improvements: {
    action: string;
    expectedImpact: 'high' | 'medium' | 'low';
    estimatedDays: number;
  }[];
}

export async function reviewProfile(
  profileDescription: string,
  platform: string,
): Promise<ProfileReviewResult> {
  const systemPrompt = `You are a freelance profile optimization expert. Evaluate freelancer profiles and provide actionable improvement recommendations. Always respond with valid JSON only.`;

  const userPrompt = `Review this freelancer profile on ${platform} and return JSON:

Profile Description:
${profileDescription}

Return this exact JSON structure:
{
  "overallScore": 0-100,
  "dimensionScores": {
    "headline": 0-20,
    "bio": 0-20,
    "skills": 0-20,
    "portfolio": 0-20,
    "completeness": 0-20
  },
  "improvements": [
    {
      "action": "specific action to take",
      "expectedImpact": "high" | "medium" | "low",
      "estimatedDays": number
    }
  ]
}
Provide exactly 3 improvements ordered by impact.`;

  const completion = await groq.chat.completions.create({
    model: GROQ_MODELS.smart,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.2,
    max_tokens: 1024,
  });

  const text = completion.choices[0]?.message?.content || '{}';
  try {
    return JSON.parse(text) as ProfileReviewResult;
  } catch {
    return {
      overallScore: 60,
      dimensionScores: { headline: 12, bio: 12, skills: 12, portfolio: 12, completeness: 12 },
      improvements: [
        { action: 'Improve your headline to highlight your main skill', expectedImpact: 'high', estimatedDays: 1 },
        { action: 'Add more portfolio samples', expectedImpact: 'high', estimatedDays: 7 },
        { action: 'Expand your bio with specific achievements', expectedImpact: 'medium', estimatedDays: 2 },
      ],
    };
  }
}
