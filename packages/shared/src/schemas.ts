import { z } from "zod";
import {
  ALLOWED_UPLOAD_MIME_TYPES,
  CREDIT_PACK_IDS,
  DEGREE_LEVELS,
  INDUSTRIES,
  MAX_EXPERIENCE_YEARS,
  MAX_PITCH_SECONDS,
  MAX_UPLOAD_BYTES,
  MIN_PITCH_SECONDS,
  PITCH_UPLOAD_MIME_TYPES,
  ROLES,
  STORAGE_BUCKET_NAMES,
  VIDEO_SESSION_QUESTION_COUNT,
  VIDEO_SESSION_TOTAL_SECONDS,
  VIDEO_SESSION_QUESTION_SECONDS,
} from "./constants";
import { getEmailDomain, isBlockedConsumerDomain } from "./helpers";

// ── Primitives ───────────────────────────────────────────────────────────────

export const uuidSchema = z.string().uuid("A valid identifier is required.");

export const corporateEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "A work email is required.")
  .email("Enter a valid email address.")
  .superRefine((email, ctx) => {
    const domain = getEmailDomain(email);
    if (!domain) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Enter a valid work email address.",
      });
      return;
    }

    if (isBlockedConsumerDomain(domain)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Corporate email required. ${domain} is a free consumer domain.`,
      });
    }
  });

export const videoDurationSchema = z.coerce
  .number({ invalid_type_error: "Video duration must be a number of seconds." })
  .int("Video duration must be a whole number of seconds.")
  .min(MIN_PITCH_SECONDS, `Your pitch must be at least ${MIN_PITCH_SECONDS} seconds.`)
  .max(MAX_PITCH_SECONDS, `Your pitch cannot exceed ${MAX_PITCH_SECONDS} seconds.`);

// ── 4-question certificate-driven video assessment ────────────────────────────
export const videoSessionQuestionSchema = z
  .object({
    index: z.union([
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.literal(4),
    ]),
    question_text: z.string().trim().min(8, "Question text is required.").max(500),
    allocated_seconds: z
      .number()
      .int()
      .min(1)
      .max(VIDEO_SESSION_TOTAL_SECONDS),
    start_offset_seconds: z.number().min(0).max(VIDEO_SESSION_TOTAL_SECONDS),
    end_offset_seconds: z.number().min(0).max(VIDEO_SESSION_TOTAL_SECONDS),
  })
  .superRefine((value, ctx) => {
    if (value.end_offset_seconds <= value.start_offset_seconds) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["end_offset_seconds"],
        message: "End offset must be after the start offset.",
      });
    }
  });

export const videoSessionQuestionsSchema = z
  .array(videoSessionQuestionSchema)
  .length(VIDEO_SESSION_QUESTION_COUNT, `Exactly ${VIDEO_SESSION_QUESTION_COUNT} questions are required.`)
  .superRefine((questions, ctx) => {
    questions.forEach((q, i) => {
      if (q.index !== i + 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "index"],
          message: `Question ${i + 1} must have index ${i + 1}.`,
        });
      }
    });

    const allocatedTotal = questions.reduce((sum, q) => sum + q.allocated_seconds, 0);
    if (allocatedTotal !== VIDEO_SESSION_TOTAL_SECONDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Allocated seconds must sum to ${VIDEO_SESSION_TOTAL_SECONDS} (got ${allocatedTotal}).`,
      });
    }

    // Chapters must be contiguous and ordered.
    for (let i = 0; i < questions.length; i += 1) {
      const q = questions[i]!;
      if (i === 0 && q.start_offset_seconds !== 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "start_offset_seconds"],
          message: "The first question must start at offset 0.",
        });
      }
      if (i > 0 && questions[i - 1]!.end_offset_seconds !== q.start_offset_seconds) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "start_offset_seconds"],
          message: "Question chapters must be contiguous.",
        });
      }
      if (q.end_offset_seconds - q.start_offset_seconds > q.allocated_seconds + 2) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [i, "end_offset_seconds"],
          message: "The recorded chapter exceeds its allocated time.",
        });
      }
    }

    const last = questions[questions.length - 1]!;
    if (last.end_offset_seconds > VIDEO_SESSION_TOTAL_SECONDS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [questions.length - 1, "end_offset_seconds"],
        message: `End offset cannot exceed ${VIDEO_SESSION_TOTAL_SECONDS} seconds.`,
      });
    }
  });

export const phoneSchema = z
  .string()
  .trim()
  .max(32, "Phone number is too long.")
  .regex(/^\+?[0-9()\-.\s]{7,24}$/, "Enter a valid phone number.");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(60).default(24),
});

// ── Candidate ────────────────────────────────────────────────────────────────

export const candidateProfileSchema = z.object({
  fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  headline: z.string().trim().max(140).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  universityName: z.string().trim().min(2, "Enter your university.").max(160),
  majorSpecialization: z
    .string()
    .trim()
    .min(2, "Enter your major or specialization.")
    .max(120),
  degreeLevel: z.enum(DEGREE_LEVELS),
  graduationYear: z.coerce
    .number()
    .int()
    .min(1950, "Graduation year is too far in the past.")
    .max(new Date().getFullYear() + 10, "Graduation year is too far in the future."),
  experienceYears: z.coerce
    .number()
    .int()
    .min(0)
    .max(MAX_EXPERIENCE_YEARS, "Experience value is too high.")
    .default(0),
  phone: phoneSchema.optional(),
});

export const candidateMediaKeysSchema = z.object({
  certificateR2Key: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((key) => !key.includes(".."), "Invalid storage key."),
  videoR2Key: z
    .string()
    .trim()
    .min(1)
    .max(512)
    .refine((key) => !key.includes(".."), "Invalid storage key."),
});

/**
 * Optional university verification URL or certificate serial. Empty strings and
 * explicit nulls collapse to null so Supabase always stores a clean value.
 */
export const certificateVerificationRefSchema = z
  .union([
    z.string().trim().max(500, "Verification reference must be 500 characters or fewer."),
    z.null(),
  ])
  .optional()
  .transform((value) => {
    const trimmed = value?.trim();
    return trimmed ? trimmed : null;
  });

export const registrarConsentGivenSchema = z.literal(true, {
  message:
    "Confirm this certificate is authentic and authorize University Talent Network to contact your university registrar or official verification portal.",
});

export const candidateVerificationSubmissionSchema = z.object({
  certificate: z.object({
    r2Key: z.string().trim().min(1).max(512),
    contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
    sizeBytes: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES["private-credentials"]),
  }),
  cv: z
    .object({
      r2Key: z.string().trim().min(1).max(512),
      contentType: z.literal("application/pdf"),
      sizeBytes: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES["private-credentials"]),
    })
    .optional(),
  video: z.object({
    r2Key: z.string().trim().min(1).max(512),
    durationSeconds: videoDurationSchema,
    contentType: z.enum(PITCH_UPLOAD_MIME_TYPES),
    sizeBytes: z.coerce.number().int().positive().max(MAX_UPLOAD_BYTES["pitch-videos"]),
  }),
  videoSessionQuestions: videoSessionQuestionsSchema,
  certificateVerificationRef: certificateVerificationRefSchema,
  registrarConsentGiven: registrarConsentGivenSchema,
  registrarConsentAt: z
    .string()
    .datetime({ offset: true, message: "Consent timestamp must be a valid ISO date." })
    .optional(),
});

export const questionGenerationRequestSchema = z.object({
  /** Optional client-provided keywords; the server also mines its own OCR text. */
  keywords: z
    .array(z.string().trim().min(1).max(40))
    .max(40)
    .optional()
    .default([]),
});

export const candidateSearchFiltersSchema = z.object({
  q: z.string().trim().max(120).optional(),
  industry: z.enum(INDUSTRIES).optional(),
  degreeLevel: z.enum(DEGREE_LEVELS).optional(),
  university: z.string().trim().max(160).optional(),
  graduationYear: z.coerce.number().int().min(1950).max(2100).optional(),
  maxExperienceYears: z.coerce.number().int().min(0).max(MAX_EXPERIENCE_YEARS).optional(),
  onlyFeatured: z.boolean().default(false),
  limit: z.coerce.number().int().min(1).max(60).default(24),
  offset: z.coerce.number().int().min(0).default(0),
});

export const candidateProCheckoutSchema = z.object({
  kind: z.literal("candidate_pro"),
});

// ── Employer & monetization ──────────────────────────────────────────────────

export const employerRegistrationSchema = z.object({
  companyName: z.string().trim().min(2, "Enter your company name.").max(120),
  corporateEmail: corporateEmailSchema,
  displayLogoConsent: z.boolean().default(true),
});

export const companyProfileSchema = z.object({
  companyName: z.string().trim().min(2).max(120),
  displayLogoConsent: z.boolean(),
});

export const unlockCandidateSchema = z.object({
  companyId: uuidSchema,
  candidateId: uuidSchema,
});

export const creditPackCheckoutSchema = z.object({
  kind: z.literal("credit_pack"),
  packId: z.enum(CREDIT_PACK_IDS),
});

export const checkoutSchema = z.discriminatedUnion("kind", [
  creditPackCheckoutSchema,
  candidateProCheckoutSchema,
]);

// ── Admin review ─────────────────────────────────────────────────────────────

export const adminVerificationDecisionSchema = z
  .object({
    candidateId: uuidSchema,
    decision: z.enum(["approve", "reject"]),
    rejectionReason: z.string().trim().max(1_000).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.decision === "reject" && !value.rejectionReason) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["rejectionReason"],
        message: "Give the candidate a clear, actionable reason for rejection.",
      });
    }
  });

// ── Messaging ────────────────────────────────────────────────────────────────

export const messageSchema = z.object({
  companyId: uuidSchema,
  candidateId: uuidSchema,
  body: z
    .string()
    .trim()
    .min(1, "Write a message.")
    .max(4_000, "Messages are limited to 4,000 characters."),
});

// ── Storage presigning ───────────────────────────────────────────────────────

export const presignUploadSchema = z
  .object({
    intent: z.literal("upload"),
    bucket: z.enum(STORAGE_BUCKET_NAMES),
    contentType: z.string().trim().min(1).max(120),
    contentLength: z.number().int().positive(),
    fileName: z.string().trim().min(1).max(200),
    videoDurationSeconds: z.coerce.number().int().optional(),
  })
  .superRefine((value, ctx) => {
    const contentType = value.contentType.toLowerCase();
    const allowedTypes = ALLOWED_UPLOAD_MIME_TYPES[value.bucket] as readonly string[];

    if (!allowedTypes.includes(contentType)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentType"],
        message: `Unsupported file type for ${value.bucket}. Allowed: ${allowedTypes.join(", ")}.`,
      });
    }

    const maxBytes = MAX_UPLOAD_BYTES[value.bucket];
    if (value.contentLength > maxBytes) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["contentLength"],
        message: `File is too large. Maximum is ${Math.round(maxBytes / (1024 * 1024))} MB.`,
      });
    }

    if (value.bucket === "pitch-videos") {
      const parsed = videoDurationSchema.safeParse(value.videoDurationSeconds);
      if (!parsed.success) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["videoDurationSeconds"],
          message: `Pitch videos must be ${MIN_PITCH_SECONDS}–${MAX_PITCH_SECONDS} seconds.`,
        });
      }
    }
  });

export const presignDownloadSchema = z
  .object({
    intent: z.literal("download"),
    bucket: z.enum(["private-credentials", "pitch-videos"]),
    key: z
      .string()
      .trim()
      .min(3)
      .max(512)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9/_.-]*$/, "Invalid storage key.")
      .refine((key) => !key.includes(".."), "Invalid storage key."),
  })
  .superRefine((value, ctx) => {
    if (!value.key.startsWith(`${value.bucket}/`)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["key"],
        message: "Storage key does not belong to the requested bucket.",
      });
    }
  });

export const presignRequestSchema = z.union([presignUploadSchema, presignDownloadSchema]);

// ── Auth / role selection (shared by web + mobile in Phase 2) ────────────────

export const roleSchema = z.enum(ROLES);

export const signUpSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Password is too long.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    role: roleSchema.exclude(["admin"]),
    companyName: z.string().trim().min(2).max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.role !== "employer") return;

    const corporateResult = corporateEmailSchema.safeParse(value.email);
    if (!corporateResult.success) {
      for (const issue of corporateResult.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: issue.message,
        });
      }
    }

    if (!value.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Company name is required for employer accounts.",
      });
    }
  });

export const signInSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  password: z.string().min(1, "Enter your password.").max(72, "Password is too long."),
});

export const signUpMetadataSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("Enter a valid email address."),
    password: z
      .string()
      .min(8, "Use at least 8 characters.")
      .max(72, "Password is too long.")
      .regex(/[A-Za-z]/, "Include at least one letter.")
      .regex(/[0-9]/, "Include at least one number."),
    role: roleSchema.exclude(["admin"]),
    companyName: z.string().trim().min(2).max(120).optional(),
    fullName: z.string().trim().min(2, "Enter your full name.").max(120),
  })
  .superRefine((value, ctx) => {
    if (value.role !== "employer") return;

    const corporateResult = corporateEmailSchema.safeParse(value.email);
    if (!corporateResult.success) {
      for (const issue of corporateResult.error.issues) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["email"],
          message: issue.message,
        });
      }
    }

    if (!value.companyName) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["companyName"],
        message: "Company name is required for employer accounts.",
      });
    }
  });

// ── Inferred input types ─────────────────────────────────────────────────────

export type CandidateProfileInput = z.infer<typeof candidateProfileSchema>;
export type CandidateVerificationSubmissionInput = z.infer<
  typeof candidateVerificationSubmissionSchema
>;
export type CandidateSearchFiltersInput = z.infer<typeof candidateSearchFiltersSchema>;
export type EmployerRegistrationInput = z.infer<typeof employerRegistrationSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type AdminVerificationDecisionInput = z.infer<typeof adminVerificationDecisionSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type PresignUploadInput = z.infer<typeof presignUploadSchema>;
export type PresignDownloadInput = z.infer<typeof presignDownloadSchema>;
export type PresignRequestInput = z.infer<typeof presignRequestSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpMetadataInput = z.infer<typeof signUpMetadataSchema>;
export type VideoDurationInput = z.infer<typeof videoDurationSchema>;
