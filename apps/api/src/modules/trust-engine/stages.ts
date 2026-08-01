import { Injectable } from '@nestjs/common';
import {
  IntakeStage,
  QualityStage,
  ClassificationStage,
  OcrStage,
  BrandValidationStage,
  DuplicateStage,
  FraudScoringStage,
  type ValidationStage,
} from '@fliptrybe/service-trust-engine';

@Injectable()
export class TrustEngineStages {
  readonly all: ValidationStage[] = [
    new IntakeStage(),
    new QualityStage(),
    new ClassificationStage(),
    new OcrStage(),
    new BrandValidationStage(),
    new DuplicateStage(),
    new FraudScoringStage(),
  ];
}
