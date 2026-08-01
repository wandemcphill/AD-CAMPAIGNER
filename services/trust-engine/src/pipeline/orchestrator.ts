/**
 * Pipeline Orchestrator — coordinates validation stages.
 * Phase 1: skeleton only. Stage execution in Phase 2+.
 */

import type {
  SubmissionContext,
  ValidationContext,
  ValidationStage,
  StageKey,
  StageOutcome,
  ArbitrationResult,
} from '../types.js';
import type { TrustEngineLogger } from '../logger.js';
import { NoOpLogger } from '../logger.js';

export interface OrchestratorInput {
  context: SubmissionContext;
  stages: ValidationStage[];
  arbitrator: Arbitrator;
  logger?: TrustEngineLogger;
}

/**
 * Arbitrates stage outcomes into a final verdict.
 */
export interface Arbitrator {
  /**
   * Given all stage results, compute the final verdict.
   * This is where bands are applied and fraud/trust scores are combined.
   */
  arbitrate(ctx: ValidationContext): Promise<ArbitrationResult>;
}

/**
 * Main orchestrator that runs the pipeline.
 */
export class PipelineOrchestrator {
  private readonly logger: TrustEngineLogger;
  private readonly stages: Map<StageKey, ValidationStage> = new Map();
  private readonly arbitrator: Arbitrator;
  private readonly startTime: number;

  private stageResults: Map<StageKey, StageOutcome> = new Map();
  private externalCalls: number = 0;
  private externalCostMicro: number = 0;

  constructor(private readonly input: OrchestratorInput) {
    this.logger = input.logger ?? new NoOpLogger();
    this.arbitrator = input.arbitrator;
    this.startTime = performance.now();

    for (const stage of input.stages) {
      this.stages.set(stage.key, stage);
    }
  }

  /**
   * Execute the pipeline: run stages in order, then arbitrate.
   */
  async execute(): Promise<{
    result: ArbitrationResult;
    stageResults: Map<StageKey, StageOutcome>;
    totalDurationMs: number;
    externalCalls: number;
    externalCostMicro: number;
  }> {
    this.logger.debug('Pipeline starting', {
      submissionId: this.input.context.submissionId,
      stages: Array.from(this.stages.keys()),
    });

    try {
      // Run stages in order. Stages are supplied pre-sorted by cost tier.
      for (const stage of this.input.stages) {
        if (!stage.supports(this.input.context)) {
          this.logger.debug(`Stage ${stage.key} not supported for this submission`);
          continue;
        }

        const stageStart = performance.now();
        let outcome: StageOutcome;

        try {
          outcome = await this.executeStage(stage);
        } catch (err) {
          // Stage threw unexpectedly; capture as INCONCLUSIVE to force REVIEW
          this.logger.error(`Stage ${stage.key} threw`, err, {
            submissionId: this.input.context.submissionId,
          });
          outcome = {
            status: 'INCONCLUSIVE',
            signals: [],
            reasons: ['SYSTEM_FAILURE'],
            durationMs: performance.now() - stageStart,
            retryCount: 0,
            failureMessage:
              err instanceof Error ? err.message : 'Unknown error',
          };
        }

        this.stageResults.set(stage.key, outcome);

        this.logger.debug(`Stage ${stage.key} completed`, {
          status: outcome.status,
          reasons: outcome.reasons,
          durationMs: outcome.durationMs,
        });

        // Check short-circuit conditions
        if (outcome.status === 'FAIL') {
          const shouldShortCircuit = this.shouldShortCircuit(stage.key);
          if (shouldShortCircuit) {
            this.logger.debug(`Short-circuiting on ${stage.key} failure`);
            break;
          }
        }
      }

      // Build validation context and arbitrate
      const validationContext = this.buildValidationContext();
      const result = await this.arbitrator.arbitrate(validationContext);

      const totalDurationMs = performance.now() - this.startTime;

      this.logger.info('Pipeline completed', {
        submissionId: this.input.context.submissionId,
        verdict: result.verdict,
        totalDurationMs,
        stageCount: this.stageResults.size,
        externalCalls: this.externalCalls,
        externalCostMicro: this.externalCostMicro,
      });

      return {
        result,
        stageResults: this.stageResults,
        totalDurationMs,
        externalCalls: this.externalCalls,
        externalCostMicro: this.externalCostMicro,
      };
    } catch (err) {
      const totalDurationMs = performance.now() - this.startTime;
      this.logger.error('Pipeline failed', err, {
        submissionId: this.input.context.submissionId,
        totalDurationMs,
      });
      throw err;
    }
  }

  /**
   * Execute a single stage with error handling.
   */
  private async executeStage(stage: ValidationStage): Promise<StageOutcome> {
    this.logger.debug(`[${stage.key}] stage executing`, {
      submissionId: this.input.context.submissionId,
    });

    const outcome = await stage.execute(this.input.context);

    // Track external calls and cost
    if (stage.key === 'classification' || stage.key === 'ocr' || stage.key === 'quality') {
      // These are expensive stages that may call inference APIs
      // (Actual tracking happens in the stage implementation)
    }

    return outcome;
  }

  /**
   * Determine if we should short-circuit after a stage failure.
   */
  private shouldShortCircuit(stageKey: StageKey): boolean {
    const config = this.input.context.config;
    const shortCircuitConfig = config.shortCircuit;

    switch (stageKey) {
      case 'intake':
        return shortCircuitConfig.onIntakeFail;
      case 'duplicate':
        return shortCircuitConfig.onDuplicate;
      case 'quality':
        return shortCircuitConfig.onQualityFail;
      default:
        return false;
    }
  }

  /**
   * Build the full validation context for the arbitrator.
   */
  private buildValidationContext(): ValidationContext {
    return {
      ...this.input.context,
      stageResults: this.stageResults,
      externalCalls: this.externalCalls,
      externalCostMicro: this.externalCostMicro,
      totalDurationMs: performance.now() - this.startTime,
    };
  }
}

/**
 * Default arbitrator: applies config thresholds.
 */
export class DefaultArbiter implements Arbitrator {
  arbitrate(ctx: ValidationContext): Promise<ArbitrationResult> {
    void ctx;
    // Phase 1: skeleton only.
    // Phase 9: implement full fraud + trust scoring.
    return Promise.resolve({
      verdict: 'REVIEW',
      reasons: [],
      explained: 'Phase 1 skeleton — no scoring yet',
      fraudScore: 50,
      trustScore: 0,
      finalScore: 50,
    });
  }
}
