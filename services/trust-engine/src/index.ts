/**
 * @fliptrybe/service-trust-engine
 *
 * The Trust Engine is a bounded context that validates user-submitted digital assets.
 * It is provider-blind, configuration-driven, and fully auditable.
 *
 * Phase 1 deliverables:
 * - Core types and contracts
 * - Configuration resolution
 * - Pipeline orchestrator skeleton
 * - Logging abstraction
 * - Repository interfaces
 *
 * Phase 2+:
 * - Individual stage implementations
 * - Fraud and trust scoring models
 * - Full pipeline execution
 */

// Types
export type {
  AssetClass,
  Verdict,
  SubmissionStatus,
  StageStatus,
  ReasonCode,
  StageOutcome,
  Signal,
  ArbitrationResult,
  SubmissionContext,
  ValidationContext,
  StageKey,
  CostTier,
  ValidationStage,
  FraudScoringModel,
  TrustScoringModel,
  SubmissionRepository,
  ValidationRunRepository,
  StageResultRepository,
  OcrResultRepository,
  ImageQualityRepository,
  BrandRuleSetRepository,
  SubmissionRow,
  ValidationRunRow,
  StageResultRow,
  OcrResultRow,
  ImageQualityRow,
  BrandRuleSetRow,
  CreateSubmissionInput,
  CreateValidationRunInput,
  CreateStageResultInput,
  TrustEngineConfig,
} from './types.js';

// Logger
export type { TrustEngineLogger } from './logger.js';
export { NoOpLogger, ConsoleLogger } from './logger.js';

// Configuration
export { ConfigResolver } from './config/config-resolver.js';
export type { ConfigResolverInput, ConfigResolverDeps } from './config/config-resolver.js';

// Pipeline
export { PipelineOrchestrator, DefaultArbiter } from './pipeline/orchestrator.js';
export type { OrchestratorInput, Arbitrator } from './pipeline/orchestrator.js';

// Stages
export { IntakeStage } from './stages/intake.stage.js';
export { QualityStage } from './stages/quality.stage.js';
export { ClassificationStage } from './stages/classification.stage.js';
export { OcrStage } from './stages/ocr.stage.js';
export { BrandValidationStage } from './stages/brand-validation.stage.js';
export { DuplicateStage } from './stages/duplicate.stage.js';
export { FraudScoringStage } from './stages/fraud-scoring.stage.js';

// Service
export { TrustEngineService } from './service.js';
export type { TrustEngineServiceDeps } from './service.js';
