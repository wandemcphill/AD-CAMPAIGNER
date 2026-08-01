/**
 * Core types for the Trust Engine pipeline.
 * These are domain types; Prisma models live in packages/database.
 */

export type AssetClass = 'GIFT_CARD' | 'AIRTIME_PIN' | 'RECHARGE_VOUCHER' | 'DIGITAL_COUPON';

export type Verdict = 'ACCEPT' | 'REVIEW' | 'REJECT';

export type SubmissionStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'ACCEPTED'
  | 'REVIEW'
  | 'REJECTED'
  | 'DISPUTED'
  | 'COMPLETED';

export type StageStatus = 'PASS' | 'FAIL' | 'INCONCLUSIVE';

export type ReasonCode =
  // Intake stage
  | 'FILE_TYPE_INVALID'
  | 'FILE_SIZE_EXCEEDS_LIMIT'
  | 'IMAGE_RESOLUTION_TOO_LOW'
  | 'IMAGE_CORRUPTED'
  | 'UPLOAD_MISSING'
  // Duplicate stage
  | 'DUPLICATE_EXACT'
  | 'DUPLICATE_NEAR'
  // Quality stage
  | 'QUALITY_TOO_DARK'
  | 'QUALITY_TOO_BRIGHT'
  | 'QUALITY_BLUR_DETECTED'
  | 'QUALITY_GLARE_DETECTED'
  | 'PARTIAL_CARD_VISIBLE'
  | 'CROPPING_DETECTED'
  | 'ROTATION_EXTREME'
  // Classification stage
  | 'UNKNOWN_ASSET_TYPE'
  | 'NOT_A_GIFT_CARD'
  | 'NOT_AN_AIRTIME_PIN'
  // OCR stage
  | 'OCR_FAILED'
  | 'OCR_LOW_CONFIDENCE'
  | 'OCR_CODE_NOT_DETECTED'
  // Brand validation
  | 'BRAND_NOT_CONFIGURED'
  | 'BRAND_DISABLED'
  | 'BRAND_MISMATCH_CONFIDENCE_LOW'
  | 'DENOMINATION_OUT_OF_RANGE'
  | 'REGION_NOT_SUPPORTED'
  // E-code validation
  | 'ECODE_LENGTH_INVALID'
  | 'ECODE_FORMAT_INVALID'
  | 'ECODE_PARTIAL'
  | 'ECODE_ALREADY_USED'
  // Fraud signals
  | 'FRAUD_DUPLICATE_RING'
  | 'FRAUD_DEVICE_MISMATCH'
  | 'FRAUD_HIGH_VELOCITY'
  | 'FRAUD_LOW_TRUST_SCORE'
  | 'FRAUD_OCR_MISMATCH'
  // System
  | 'SYSTEM_FAILURE'
  | 'INFERENCE_TIMEOUT'
  | 'CONFIG_MISSING';

/**
 * A stage output. Stages never decide; they emit signals and reasons.
 * Only the Arbiter converts these into a verdict.
 */
export interface StageOutcome {
  readonly status: StageStatus;
  readonly signals: readonly Signal[];
  readonly reasons: readonly ReasonCode[];
  readonly evidenceRef?: string; // FK to stage result row
  readonly durationMs: number;
  readonly retryCount: number;
  readonly failureMessage?: string; // if status === FAIL
}

/**
 * A typed signal emitted by a stage, consumed by the fraud model.
 */
export interface Signal {
  readonly key: string; // 'duplicate_found', 'blur_score', 'device_mismatch', etc.
  readonly value: number; // raw value, unit-agnostic
  readonly confidence: number; // 0–100
  readonly weight?: number; // 0–100, importance to fraud score
}

/**
 * The arbiter's verdict: which action to take and why.
 */
export interface ArbitrationResult {
  readonly verdict: Verdict;
  readonly reasons: readonly ReasonCode[];
  readonly explained: string; // human-readable summary
  readonly fraudScore: number; // 0–100
  readonly trustScore: number; // -100 to +100
  readonly finalScore: number; // arbiter's computed score used for bands
}

/**
 * Context passed through the pipeline to stages.
 */
export interface SubmissionContext {
  readonly submissionId: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly assetClass: AssetClass;
  readonly submissionProfile: Record<string, unknown>; // { brand?, region?, denomination?, ... }

  // Evidence collected so far
  readonly mediaAssetId?: string;
  readonly mediaAssetUrl?: string;
  readonly mediaAssetByteSize?: number;
  readonly mediaAssetWidth?: number;
  readonly mediaAssetHeight?: number;
  readonly mediaAssetExifRotation?: number;
  readonly checksumSha256?: string;

  // Runtime
  readonly config: TrustEngineConfig;
  readonly configVersion: number;
  readonly pipelineVersion: number;
}

/**
 * Full run context for arbiter.
 */
export interface ValidationContext extends SubmissionContext {
  readonly stageResults: Map<StageKey, StageOutcome>;
  readonly externalCalls: number;
  readonly externalCostMicro: number;
  readonly totalDurationMs: number;
}

export type StageKey =
  | 'intake'
  | 'duplicate'
  | 'quality'
  | 'classification'
  | 'ocr'
  | 'brand_validation'
  | 'ecode_format'
  | 'fraud_scoring';

export type CostTier = 'FREE' | 'CHEAP' | 'EXPENSIVE';

/**
 * Stage contract. Every stage implements this.
 */
export interface ValidationStage<TContext extends SubmissionContext = SubmissionContext> {
  readonly key: StageKey;
  readonly costTier: CostTier;

  /** Whether this stage should run for this submission. */
  supports(ctx: TContext): boolean;

  /** Execute the stage and return outcome. Never throws; errors are captured in outcome. */
  execute(ctx: TContext): Promise<StageOutcome>;
}

/**
 * Fraud scoring model: reads signals, outputs a score.
 */
export interface FraudScoringModel {
  /**
   * Compute fraud score from signals collected so far.
   * Score is 0–100: higher = more suspicious.
   */
  compute(signals: readonly Signal[]): Promise<number>;
}

/**
 * Trust scoring model: reads actor history, outputs a score.
 */
export interface TrustScoringModel {
  /**
   * Compute trust score for a user.
   * Score is -100 to +100: positive = trustworthy, negative = risky.
   */
  compute(userId: string, workspaceId: string): Promise<number>;
}

/**
 * Repository interfaces: abstraction for data access.
 * Implementations live in apps/api/src/modules/trust-engine.
 */
export interface SubmissionRepository {
  create(data: CreateSubmissionInput): Promise<SubmissionRow>;
  getById(submissionId: string): Promise<SubmissionRow | null>;
  updateStatus(submissionId: string, status: SubmissionStatus): Promise<void>;
}

export interface ValidationRunRepository {
  create(data: CreateValidationRunInput): Promise<ValidationRunRow>;
  getById(runId: string): Promise<ValidationRunRow | null>;
  getLatestBySubmissionId(submissionId: string): Promise<ValidationRunRow | null>;
}

export interface StageResultRepository {
  create(data: CreateStageResultInput): Promise<StageResultRow>;
  getByValidationRunId(runId: string): Promise<StageResultRow[]>;
}

export interface OcrResultRepository {
  getLatestBySubmissionId(submissionId: string): Promise<OcrResultRow | null>;
}

export interface ImageQualityRepository {
  getLatestBySubmissionId(submissionId: string): Promise<ImageQualityRow | null>;
}

export interface BrandRuleSetRepository {
  getByAssetClassAndBrand(
    assetClass: AssetClass,
    brand: string,
    region?: string
  ): Promise<BrandRuleSetRow | null>;
  listEnabledByAssetClass(assetClass: AssetClass): Promise<BrandRuleSetRow[]>;
}

/**
 * Row types: shape of data from the database.
 */
export interface SubmissionRow {
  id: string;
  workspaceId: string;
  userId: string;
  assetClass: AssetClass;
  status: SubmissionStatus;
  mediaAssetId?: string;
  submissionProfile: Record<string, unknown>;
  lastValidationRunId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidationRunRow {
  id: string;
  submissionId: string;
  configVersion: number;
  pipelineVersion: number;
  idempotencyKey: string;
  verdict: Verdict;
  verdictReasons: ReasonCode[];
  verdictExplained: string;
  fraudScore: number;
  trustScore: number;
  finalScore: number;
  stageDurationMs: Record<string, number>;
  totalDurationMs: number;
  stagesFailed: string[];
  stagesInconcl: string[];
  externalCalls: number;
  externalCostMicro: number;
  createdAt: Date;
}

export interface StageResultRow {
  id: string;
  validationRunId: string;
  stageKey: StageKey;
  status: StageStatus;
  signals: Signal[];
  reasonCodes: ReasonCode[];
  resultData?: Record<string, unknown>;
  retryCount: number;
  durationMs: number;
  failureMessage?: string;
  createdAt: Date;
}

export interface OcrResultRow {
  id: string;
  submissionId: string;
  brand?: string;
  regionCode?: string;
  denomination?: string;
  visibleText: string[];
  overallConfidence: number;
  fieldConfidence: Record<string, number>;
  ocrEngine: string;
  detectedCodeCount: number;
  createdAt: Date;
}

export interface ImageQualityRow {
  id: string;
  submissionId: string;
  blurScore: number;
  darkScore: number;
  glareScore: number;
  exposureOk: boolean;
  croppingDetected: boolean;
  partialCardVisible: boolean;
  rotationDegrees?: number;
  perspective?: string;
  assessmentEngine: string;
  createdAt: Date;
}

export interface BrandRuleSetRow {
  id: string;
  assetClass: AssetClass;
  brand: string;
  region?: string;
  minDenomination?: number;
  maxDenomination?: number;
  allowedDenominations?: number[];
  ecodeLengthMin?: number;
  ecodeLengthMax?: number;
  ecodeFormatRegex?: string;
  minQualityScore: number;
  requireFullCard: boolean;
  requireNoCropping: boolean;
  allowPartialOcr: boolean;
  suspectIfOcrMismatchConfidence: number;
  duplicateHarsh: boolean;
  enabled: boolean;
  priority: number;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

// Input types for repositories
export interface CreateSubmissionInput {
  id: string;
  workspaceId: string;
  userId: string;
  assetClass: AssetClass;
  mediaAssetId?: string;
  submissionProfile: Record<string, unknown>;
}

export interface CreateValidationRunInput {
  id: string;
  submissionId: string;
  configVersion: number;
  pipelineVersion: number;
  idempotencyKey: string;
  verdict?: Verdict;
  verdictReasons?: ReasonCode[];
  verdictExplained?: string;
  fraudScore?: number;
  trustScore?: number;
  finalScore?: number;
}

export interface CreateStageResultInput {
  id: string;
  validationRunId: string;
  stageKey: StageKey;
  status: StageStatus;
  signals: Signal[];
  reasonCodes: ReasonCode[];
  resultData?: Record<string, unknown>;
  retryCount: number;
  durationMs: number;
  failureMessage?: string;
}

/**
 * Configuration that is resolved per-request.
 */
export interface TrustEngineConfig {
  version: number;
  thresholds: {
    acceptMax: number; // fraud score ≤ this → ACCEPT
    rejectMin: number; // fraud score ≥ this → REJECT
  };
  stageLimits: {
    maxDurationPerStageMs: number;
    maxTotalDurationMs: number;
    maxExternalCalls: number;
    maxCostPerSubmissionMicro: number;
  };
  qualityThresholds: {
    minQualityScore: number;
    requireFullCard: boolean;
    minOcrConfidence: number;
  };
  duplicatePolicy: {
    exactReject: boolean;
    nearReview: boolean;
    historyDays: number;
  };
  inference: {
    provider: 'local' | 'google_vision' | 'anthropic' | 'hybrid';
    qualityAssessmentEngine: string;
    ocrEngine: string;
  };
  shortCircuit: {
    onIntakeFail: boolean;
    onDuplicate: boolean;
    onQualityFail: boolean;
  };
  enabledAssetClasses: AssetClass[];
  enabledBrands: string[];
}
