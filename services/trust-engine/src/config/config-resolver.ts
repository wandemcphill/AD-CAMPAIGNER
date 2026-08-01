/**
 * Resolves Trust Engine configuration from environment and database.
 * Phase 1: Environment variables only. Database loading in Phase 1.5.
 */

import type { TrustEngineConfig, AssetClass } from '../types.js';
import { type TrustEngineLogger, NoOpLogger } from '../logger.js';

type InferenceProvider = TrustEngineConfig['inference']['provider'];

const inferenceProviders: InferenceProvider[] = ['local', 'google_vision', 'anthropic', 'hybrid'];

export interface ConfigResolverInput {
  workspaceId: string;
  userId: string;
  logger?: TrustEngineLogger;
}

export interface ConfigResolverDeps {
  /**
   * Load workspace-specific config from database.
   * Returns null if no override exists; global defaults are used.
   */
  loadWorkspaceConfig?(workspaceId: string): Promise<Partial<TrustEngineConfig> | null>;
}

export class ConfigResolver {
  private readonly logger: TrustEngineLogger;
  private readonly deps: ConfigResolverDeps;

  constructor(deps: ConfigResolverDeps = {}, logger?: TrustEngineLogger) {
    this.deps = deps;
    this.logger = logger ?? new NoOpLogger();
  }

  /**
   * Resolve configuration for a request.
   * Merges global defaults with workspace overrides.
   */
  async resolve(input: ConfigResolverInput): Promise<TrustEngineConfig> {
    const globalDefaults = this.loadGlobalDefaults();
    let workspaceOverrides: Partial<TrustEngineConfig> | null = null;

    if (this.deps.loadWorkspaceConfig) {
      try {
        workspaceOverrides = await this.deps.loadWorkspaceConfig(input.workspaceId);
      } catch (err) {
        this.logger.warn('Failed to load workspace config; using global defaults', {
          workspaceId: input.workspaceId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    const config = this.merge(globalDefaults, workspaceOverrides ?? {});

    this.logger.debug('Config resolved', {
      workspaceId: input.workspaceId,
      configVersion: config.version,
      thresholds: config.thresholds,
    });

    return config;
  }

  /**
   * Load global defaults from environment variables.
   */
  private loadGlobalDefaults(): TrustEngineConfig {
    const env = process.env;

    return {
      version: this.parseIntEnv(env.TRUST_ENGINE_CONFIG_VERSION, 1),

      thresholds: {
        acceptMax: this.parseIntEnv(env.TRUST_ENGINE_FRAUD_ACCEPT_MAX, 30),
        rejectMin: this.parseIntEnv(env.TRUST_ENGINE_FRAUD_REJECT_MIN, 70),
      },

      stageLimits: {
        maxDurationPerStageMs: this.parseIntEnv(
          env.TRUST_ENGINE_MAX_DURATION_PER_STAGE_MS,
          10_000
        ),
        maxTotalDurationMs: this.parseIntEnv(
          env.TRUST_ENGINE_MAX_TOTAL_DURATION_MS,
          30_000
        ),
        maxExternalCalls: this.parseIntEnv(env.TRUST_ENGINE_MAX_EXTERNAL_CALLS, 5),
        maxCostPerSubmissionMicro: this.parseIntEnv(
          env.TRUST_ENGINE_MAX_COST_PER_SUBMISSION_MICRO,
          50_000
        ),
      },

      qualityThresholds: {
        minQualityScore: this.parseIntEnv(env.TRUST_ENGINE_MIN_QUALITY_SCORE, 50),
        requireFullCard: this.parseBoolEnv(env.TRUST_ENGINE_REQUIRE_FULL_CARD, true),
        minOcrConfidence: this.parseIntEnv(env.TRUST_ENGINE_MIN_OCR_CONFIDENCE, 60),
      },

      duplicatePolicy: {
        exactReject: this.parseBoolEnv(env.TRUST_ENGINE_DUPLICATE_EXACT_REJECT, true),
        nearReview: this.parseBoolEnv(env.TRUST_ENGINE_DUPLICATE_NEAR_REVIEW, true),
        historyDays: this.parseIntEnv(env.TRUST_ENGINE_DUPLICATE_HISTORY_DAYS, 90),
      },

      inference: {
        provider: (
          env.TRUST_ENGINE_INFERENCE_PROVIDER ?? 'hybrid'
        ).toLowerCase() as 'local' | 'google_vision' | 'anthropic' | 'hybrid',
        qualityAssessmentEngine:
          env.TRUST_ENGINE_QUALITY_ASSESSMENT_ENGINE ?? 'local_heuristic',
        ocrEngine: env.TRUST_ENGINE_OCR_ENGINE ?? 'google_vision',
      },

      shortCircuit: {
        onIntakeFail: this.parseBoolEnv(env.TRUST_ENGINE_SHORT_CIRCUIT_ON_INTAKE_FAIL, true),
        onDuplicate: this.parseBoolEnv(env.TRUST_ENGINE_SHORT_CIRCUIT_ON_DUPLICATE, false),
        onQualityFail: this.parseBoolEnv(
          env.TRUST_ENGINE_SHORT_CIRCUIT_ON_QUALITY_FAIL,
          false
        ),
      },

      enabledAssetClasses: this.parseAssetClasses(
        env.TRUST_ENGINE_ENABLED_ASSET_CLASSES ?? 'GIFT_CARD'
      ),
      enabledBrands: this.parseBrands(env.TRUST_ENGINE_ENABLED_BRANDS ?? ''),
    };
  }

  private merge(
    defaults: TrustEngineConfig,
    overrides: Partial<TrustEngineConfig>
  ): TrustEngineConfig {
    return {
      version: overrides.version ?? defaults.version,
      thresholds: {
        acceptMax: overrides.thresholds?.acceptMax ?? defaults.thresholds.acceptMax,
        rejectMin: overrides.thresholds?.rejectMin ?? defaults.thresholds.rejectMin,
      },
      stageLimits: {
        maxDurationPerStageMs:
          overrides.stageLimits?.maxDurationPerStageMs ??
          defaults.stageLimits.maxDurationPerStageMs,
        maxTotalDurationMs:
          overrides.stageLimits?.maxTotalDurationMs ??
          defaults.stageLimits.maxTotalDurationMs,
        maxExternalCalls:
          overrides.stageLimits?.maxExternalCalls ?? defaults.stageLimits.maxExternalCalls,
        maxCostPerSubmissionMicro:
          overrides.stageLimits?.maxCostPerSubmissionMicro ??
          defaults.stageLimits.maxCostPerSubmissionMicro,
      },
      qualityThresholds: {
        minQualityScore:
          overrides.qualityThresholds?.minQualityScore ??
          defaults.qualityThresholds.minQualityScore,
        requireFullCard:
          overrides.qualityThresholds?.requireFullCard ??
          defaults.qualityThresholds.requireFullCard,
        minOcrConfidence:
          overrides.qualityThresholds?.minOcrConfidence ??
          defaults.qualityThresholds.minOcrConfidence,
      },
      duplicatePolicy: {
        exactReject:
          overrides.duplicatePolicy?.exactReject ?? defaults.duplicatePolicy.exactReject,
        nearReview:
          overrides.duplicatePolicy?.nearReview ?? defaults.duplicatePolicy.nearReview,
        historyDays:
          overrides.duplicatePolicy?.historyDays ?? defaults.duplicatePolicy.historyDays,
      },
      inference: {
        provider: this.normalizeInferenceProvider(
          overrides.inference?.provider,
          defaults.inference.provider
        ),
        qualityAssessmentEngine:
          overrides.inference?.qualityAssessmentEngine ??
          defaults.inference.qualityAssessmentEngine,
        ocrEngine: overrides.inference?.ocrEngine ?? defaults.inference.ocrEngine,
      },
      shortCircuit: {
        onIntakeFail:
          overrides.shortCircuit?.onIntakeFail ?? defaults.shortCircuit.onIntakeFail,
        onDuplicate:
          overrides.shortCircuit?.onDuplicate ?? defaults.shortCircuit.onDuplicate,
        onQualityFail:
          overrides.shortCircuit?.onQualityFail ?? defaults.shortCircuit.onQualityFail,
      },
      enabledAssetClasses:
        overrides.enabledAssetClasses ?? defaults.enabledAssetClasses,
      enabledBrands: overrides.enabledBrands ?? defaults.enabledBrands,
    };
  }

  private parseIntEnv(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = parseInt(value, 10);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  private parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
    if (!value) return defaultValue;
    return value.toLowerCase() === 'true' || value === '1';
  }

  private normalizeInferenceProvider(
    value: InferenceProvider | undefined,
    fallback: InferenceProvider
  ): InferenceProvider {
    return value && inferenceProviders.includes(value) ? value : fallback;
  }

  private parseAssetClasses(value: string): AssetClass[] {
    if (!value) return ['GIFT_CARD'];
    return value.split(',').map((s) => s.trim().toUpperCase() as AssetClass);
  }

  private parseBrands(value: string): string[] {
    if (!value) return [];
    return value.split(',').map((s) => s.trim());
  }
}
