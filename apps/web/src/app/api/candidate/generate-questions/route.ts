import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import {
  questionGenerationRequestSchema,
  sanitizeAcademicKeywords,
  videoSessionQuestionsSchema,
  type VideoSessionQuestion,
} from "@utn/shared";
import { env } from "@/lib/env";
import { requireApiCaller } from "@/lib/api/auth";
import { apiError, methodNotAllowed } from "@/lib/api/http";
import { RATE_LIMITS } from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TOTAL_SECONDS = 133;
const INTRO_SECONDS = 5;
const DISPLAY_SECONDS = 7;
const ANSWER_SECONDS = 25;
const PER_QUESTION_SECONDS = DISPLAY_SECONDS + ANSWER_SECONDS; // 32

const SYSTEM_PROMPT = `You are an academic assessment designer for a verified talent platform.

Given a candidate's degree, major/specialization, university, industry, and a short
professional description/headline they provided, generate exactly 4 sharp, domain-specific
interview assessment questions. Return ONLY a JSON object with this exact shape:

{
  "questions": [
    { "index": 1, "question_text": "..." },
    { "index": 2, "question_text": "..." },
    { "index": 3, "question_text": "..." },
    { "index": 4, "question_text": "..." }
  ]
}

Category requirements (UTN Core — one competency dimension per question, in order):
- Q1 (index 1): Core Theoretical Mastery — probe the candidate's grasp of the fundamentals of their degree.
- Q2 (index 2): Applied Scenario & Edge-Case Judgment — a concrete scenario or problem in their specialization.
- Q3 (index 3): Analytical Trade-Offs — a real-world application, project, or analysis with trade-offs.
- Q4 (index 4): Real-World Execution — why hire them, first-90-days value.
Calibrate difficulty to the candidate's intake readiness level and academic grade.

Rules:
- Each question must be answerable aloud in about 30 seconds.
- Questions must be specific to the degree/major, never generic.
- Do not ask for personal identifiers, grades, or confidential information.
- Return strict JSON only, no markdown, no commentary.`;

const modelQuestionSchema = z.object({
  index: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  question_text: z.string().trim().min(8).max(500),
});

const modelResponseSchema = z.object({
  questions: z.array(modelQuestionSchema).length(4),
});

function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const match = trimmed.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

function buildChapters(questionTexts: string[]): VideoSessionQuestion[] {
  // Q1 includes the 5s intro countdown; Q2-Q4 are display+answer only.
  const starts = [0, INTRO_SECONDS + PER_QUESTION_SECONDS, INTRO_SECONDS + 2 * PER_QUESTION_SECONDS, INTRO_SECONDS + 3 * PER_QUESTION_SECONDS] as const;
  const ends = [INTRO_SECONDS + PER_QUESTION_SECONDS, INTRO_SECONDS + 2 * PER_QUESTION_SECONDS, INTRO_SECONDS + 3 * PER_QUESTION_SECONDS, INTRO_SECONDS + 4 * PER_QUESTION_SECONDS] as const;
  const allocated = [INTRO_SECONDS + PER_QUESTION_SECONDS, PER_QUESTION_SECONDS, PER_QUESTION_SECONDS, PER_QUESTION_SECONDS] as const;
  return questionTexts.map((text, i) => ({
    index: (i + 1) as 1 | 2 | 3 | 4,
    question_text: text,
    allocated_seconds: allocated[i]!,
    start_offset_seconds: starts[i]!,
    end_offset_seconds: ends[i]!,
  }));
}

function disciplineOf(major: string, keywords: string[]): string {
  const haystack = `${major} ${keywords.join(" ")}`.toLowerCase();
  if (/(software|computer|data|machine learning|artificial intelligence|ai|ml|cyber|information technology|it\b)/.test(haystack)) return "computing";
  if (/(mechanical|electrical|civil|chemical|industrial|aerospace|biomedical) engineering/.test(haystack) || /\bengineering\b/.test(haystack)) return "engineering";
  if (/(finance|accounting|economics|banking|investment|actuarial)/.test(haystack)) return "finance";
  if (/(law|legal|jurisprudence)/.test(haystack)) return "law";
  if (/(medicine|medical|nursing|pharmacy|health|clinical|biomedical)/.test(haystack)) return "health";
  if (/(business|management|mba|commerce|entrepreneur)/.test(haystack)) return "business";
  if (/(design|ux|ui|graphic|product design|architecture)/.test(haystack)) return "design";
  if (/(education|teaching|pedagogy)/.test(haystack)) return "education";
  if (/(physics|chemistry|biology|science|mathematics|statistics)/.test(haystack)) return "science";
  if (/(marketing|communications|media|journalism)/.test(haystack)) return "marketing";
  return "general";
}

function fallbackQuestions(degree: string, major: string, university: string, industry: string, description: string, keywords: string[]): string[] {
  const d = disciplineOf(major, [industry, description, ...keywords]);
  const kw = (description || keywords.slice(0, 3).join(", ") || major).slice(0, 80);
  const templates: Record<string, [string, string, string, string]> = {
    computing: [
      `In 30 seconds, explain the core data structures or algorithms from your ${major} studies at ${university} that you rely on most, and why.`,
      `You are given a production bug in a ${major} system with limited logs. Walk through how you would isolate, reproduce, and fix it, including the trade-offs you would consider.`,
      `Describe a project or coursework where you built or improved a software system. What was your specific contribution, the measurable outcome, and what would you change?`,
      `Why should an employer hire you for a ${major} role, and what concrete value would you deliver in your first 90 days?`,
    ],
    engineering: [
      `Summarise the core engineering principles from your ${major} degree at ${university} that you apply when approaching a new design problem.`,
      `A ${major} component is failing under load in the field. Walk through your diagnostic and remediation process, including safety and cost trade-offs.`,
      `Describe a hands-on project where you designed or tested something in ${major}. What constraints did you face, how did you validate the result, and what would you improve?`,
      `What makes you ready to contribute as a ${major} engineer from day one, and what would you deliver in your first 90 days?`,
    ],
    finance: [
      `Explain the core financial concepts from your ${major} studies at ${university} that you would use to evaluate a new investment or budget decision.`,
      `Given incomplete financial data for a company, walk through how you would assess its health and the assumptions you would flag.`,
      `Describe a case study or project where you analysed financial information and produced a recommendation. What was the outcome and your reasoning?`,
      `Why should an employer hire you for a ${major} role, and what value would you add in your first 90 days?`,
    ],
    law: [
      `Outline the core legal principles from your ${major} degree at ${university} that you would apply when reading a new contract or statute.`,
      `A client presents a fact pattern with conflicting evidence. Walk through how you would structure the legal analysis and identify the controlling issues.`,
      `Describe a moot, clinic, or research project where you applied legal reasoning to a real problem. What was your conclusion and its limits?`,
      `What makes you ready to add value in a ${major} role from day one, and what would you deliver in your first 90 days?`,
    ],
    health: [
      `Summarise the core clinical or scientific foundations from your ${major} degree at ${university} that guide your professional judgement.`,
      `A patient or case presents ambiguous symptoms. Walk through how you would gather evidence, prioritise risks, and decide on next steps.`,
      `Describe a clinical rotation, research project, or case study where you applied ${major} knowledge. What was your role and the outcome?`,
      `Why should an employer or institution hire you for a ${major} role, and what value would you deliver in your first 90 days?`,
    ],
    business: [
      `Explain the core business principles from your ${major} studies at ${university} that you would use to evaluate a new initiative.`,
      `A team is missing its targets. Walk through how you would diagnose the root cause and propose a corrective plan with measurable milestones.`,
      `Describe a project where you led or contributed to a business outcome. What was your role, the result, and what would you do differently?`,
      `What makes you ready to contribute in a ${major} role from day one, and what would you deliver in your first 90 days?`,
    ],
    design: [
      `Summarise the core design principles from your ${major} studies at ${university} that shape how you solve user problems.`,
      `A product has poor usability feedback. Walk through how you would research, prototype, and validate an improvement.`,
      `Describe a portfolio project where you designed an experience or artefact. What was your process, the outcome, and what would you refine?`,
      `Why should an employer hire you for a ${major} role, and what value would you add in your first 90 days?`,
    ],
    education: [
      `Explain the core pedagogical principles from your ${major} degree at ${university} that guide your teaching practice.`,
      `A learner is struggling to grasp a concept. Walk through how you would diagnose the gap and adapt your instruction.`,
      `Describe a lesson, project, or placement where you applied ${major} methods. What was the outcome and what would you change?`,
      `What makes you ready to contribute as a ${major} educator from day one, and what would you deliver in your first 90 days?`,
    ],
    science: [
      `Summarise the core scientific methods from your ${major} studies at ${university} that you would apply to a new research question.`,
      `Given an unexpected experimental result, walk through how you would verify, explain, and follow up on it.`,
      `Describe a research project or lab exercise where you applied ${major} methods. What was your hypothesis, method, and finding?`,
      `Why should an employer or lab hire you for a ${major} role, and what would you deliver in your first 90 days?`,
    ],
    marketing: [
      `Explain the core marketing principles from your ${major} studies at ${university} that you would use to launch a new product.`,
      `A campaign is underperforming. Walk through how you would audit it and propose a data-informed optimisation.`,
      `Describe a project where you created or measured a marketing outcome. What was your role, the result, and what would you change?`,
      `What makes you ready to contribute in a ${major} role from day one, and what would you deliver in your first 90 days?`,
    ],
    general: [
      `In 30 seconds, describe the core knowledge from your ${degree} in ${major} at ${university} that you would bring to a professional role.`,
      `A stakeholder asks you to solve a problem outside your direct experience. Walk through how you would structure your approach and where you would seek support.`,
      `Describe a project or piece of work where you applied what you learned in ${major}. What was your contribution and the outcome?`,
      `Why should an employer hire you, and what specific value would you deliver in your first 90 days?`,
    ],
  };
  const t = templates[d] ?? templates.general ?? templates.general!;
  return (t ?? []).map((q) => q.replace(/\s+/g, " ").trim());
}

async function callGroq(prompt: string): Promise<string[] | null> {
  if (!env.groqApiKey) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.groqApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
        temperature: 0.4,
        max_tokens: 900,
        response_format: { type: "json_object" },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = body.choices?.[0]?.message?.content;
    if (!content) return null;
    const parsed = modelResponseSchema.safeParse(extractJson(content));
    if (!parsed.success) return null;
    return parsed.data.questions
      .sort((a, b) => a.index - b.index)
      .map((q) => q.question_text);
  } catch {
    return null;
  }
}

async function callGemini(prompt: string): Promise<string[] | null> {
  if (!env.geminiApiKey) return null;
  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${encodeURIComponent(env.geminiApiKey)}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${SYSTEM_PROMPT}\n\n${prompt}` }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.4,
          maxOutputTokens: 900,
        },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const content = body.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) return null;
    const parsed = modelResponseSchema.safeParse(extractJson(content));
    if (!parsed.success) return null;
    return parsed.data.questions
      .sort((a, b) => a.index - b.index)
      .map((q) => q.question_text);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const auth = await requireApiCaller(request, { rateLimit: RATE_LIMITS.generateQuestions });
  if (!auth.ok) return auth.response;

  if (auth.caller.role !== "candidate") {
    return apiError(403, "candidate_only", "Only candidates can generate assessment questions.");
  }

  const userId = auth.caller.userId;

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const parsed = questionGenerationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return apiError(422, "validation_failed", "Invalid request body.", { issues: parsed.error.issues });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return apiError(503, "supabase_not_configured", "Authentication is not configured.");
  }

  const { data: profile, error: profileError } = await admin
    .from("candidate_profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  if (profileError) {
    console.error("[generate-questions] profile lookup failed", profileError);
    return apiError(500, "profile_lookup_failed", "Could not load your profile.");
  }
  if (!profile) {
    return apiError(403, "candidate_profile_missing", "Complete your profile first.");
  }
  if (profile.verification_status === "verified") {
    return apiError(409, "already_verified", "Your verification is already approved.");
  }

  const major = (profile.major_specialization as string | null)?.trim();
  const degree = String(profile.degree_level);
  const university = String(profile.university_name);
  const industry = (profile.industry as string | null)?.trim() || "";
  const description = (profile.headline as string | null)?.trim() || "";
  const academicGrade = (profile.academic_grade as string | null)?.trim() || "";
  const readinessLevel = (profile.intake_readiness_level as string | null)?.trim() || "intermediate";
  if (!major) {
    return apiError(
      422,
      "major_required",
      "Add your major or specialization to your profile before generating questions.",
    );
  }

  const { data: media, error: mediaError } = await admin
    .from("candidate_media")
    .select("*")
    .eq("candidate_id", userId)
    .maybeSingle();

  if (mediaError) {
    console.error("[generate-questions] media lookup failed", mediaError);
    return apiError(500, "media_lookup_failed", "Could not load your certificate.");
  }
  if (!media?.certificate_r2_key) {
    return apiError(409, "certificate_required", "Upload your degree certificate first.");
  }

  // Idempotent: once questions exist, do not regenerate (prevents cherry-picking).
  const existing = media.video_session_questions as VideoSessionQuestion[] | null;
  if (existing && Array.isArray(existing) && existing.length === 4) {
    // Allow regeneration only when an admin has rejected the submission.
    if (profile.verification_status !== "rejected") {
      return NextResponse.json({
        questions: existing,
        source: "stored",
        reused: true,
      });
    }
  }

  // Fetch prior cycle question hashes so renewal never repeats them.
  const { data: priorHistory } = await admin
    .from("utn_core_question_history")
    .select("question_text")
    .eq("candidate_id", userId);
  const priorQuestions = (priorHistory ?? []).map((r: { question_text: string }) => r.question_text);

  // Questions are derived from the specialization + the candidate's own description,
  // not from the certificate (which may be a template/scan). OCR text is ignored.
  const clientKeywords = sanitizeAcademicKeywords(parsed.data.keywords ?? []);
  const keywords = Array.from(
    new Set([
      ...sanitizeAcademicKeywords([major, description, industry].join(" ")),
      ...clientKeywords,
    ]),
  );

  const prompt = `Candidate degree: ${degree}
Major/specialization: ${major}
University: ${university}
Industry: ${industry || "(not specified)"}
Academic grade / honors: ${academicGrade || "(not provided)"}
Intake readiness level: ${readinessLevel}
Candidate description/headline: ${description || "(not provided)"}
Sanitized academic keywords: ${keywords.join(", ") || "(none)"}
Prior questions from previous cycles (MUST NOT repeat or paraphrase): ${priorQuestions.length ? priorQuestions.join(" | ") : "(none)"}
Competency dimensions (one per question, in order): Core Theoretical Mastery, Applied Scenario & Edge-Case Judgment, Analytical Trade-Offs, Real-World Execution

Generate the 4 assessment questions now. Base the questions on the specialization and the candidate's description, not on any certificate text.`;

  let questionTexts: string[] | null = null;
  let source = "fallback";

  if (env.groqApiKey) {
    const result = await callGroq(prompt);
    if (result) {
      questionTexts = result;
      source = "groq";
    }
  }
  if (!questionTexts && env.geminiApiKey) {
    const result = await callGemini(prompt);
    if (result) {
      questionTexts = result;
      source = "gemini";
    }
  }
  if (!questionTexts) {
    questionTexts = fallbackQuestions(degree, major, university, industry, description, keywords);
    source = "fallback";
  }

  const chapters = buildChapters(questionTexts);

  // Validate the assembled payload against the shared schema.
  const validated = videoSessionQuestionsSchema.safeParse(chapters);
  if (!validated.success) {
    console.error("[generate-questions] assembled payload invalid", validated.error);
    return apiError(500, "generation_failed", "Could not assemble the assessment questions.");
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await admin
    .from("candidate_media")
    .upsert(
      {
        candidate_id: userId,
        certificate_r2_key: media.certificate_r2_key,
        video_session_questions: validated.data,
        video_total_duration_seconds: TOTAL_SECONDS,
        questions_generated_at: now,
      },
      { onConflict: "candidate_id" },
    );

  if (upsertError) {
    console.error("[generate-questions] persist failed", upsertError);
    return apiError(500, "persist_failed", "Could not save the generated questions.");
  }

  // Persist to UTN Core question history (non-repeating across cycles).
  const dimensions = [
    "Core Theoretical Mastery",
    "Applied Scenario & Edge-Case Judgment",
    "Analytical Trade-Offs",
    "Real-World Execution",
  ];
  const cycle = Number(profile.renewal_cycle_count ?? 1);
  try {
    const rows = validated.data.map((q, i) => ({
      candidate_id: userId,
      renewal_cycle: cycle,
      question_hash: createHash("sha256").update(q.question_text.trim().toLowerCase()).digest("hex"),
      question_text: q.question_text,
      competency_dimension: dimensions[i] ?? dimensions[0],
    }));
    await admin.from("utn_core_question_history").insert(rows);
  } catch (e) {
    console.error("[generate-questions] history insert failed", e);
  }

  return NextResponse.json({
    questions: validated.data,
    source,
    reused: false,
  });
}

export function GET() {
  return methodNotAllowed("POST");
}
