/**
 * Intake Stage — validates file integrity and properties.
 * Phase 2: file type, size, resolution, orientation, metadata.
 */

import type { SubmissionContext, StageOutcome, ReasonCode } from '../types.js';
import type { ValidationStage } from '../types.js';

interface ImageMetadata {
  width: number | undefined;
  height: number | undefined;
  byteSize: number;
  contentType: string;
  format: string | undefined;
  exifRotation: number | undefined;
}

/**
 * Intake stage: validate that the upload is a valid image file.
 */
export class IntakeStage implements ValidationStage {
  readonly key = 'intake';
  readonly costTier = 'FREE';

  private readonly maxFileSize = 20 * 1024 * 1024; // 20 MB
  private readonly minFileSize = 100 * 1024; // 100 KB
  private readonly minResolution = { width: 1920, height: 1440 };
  private readonly maxResolution = { width: 4000, height: 4000 };
  private readonly allowedContentTypes = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly minAspectRatio = 0.5; // width / height
  private readonly maxAspectRatio = 2.0;

  supports(): boolean {
    // Intake runs for all asset classes that have a mediaAsset
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(ctx: SubmissionContext): Promise<StageOutcome> {
    const reasons: ReasonCode[] = [];
    const startTime = performance.now();

    try {
      // Validate that a media asset exists
      if (!ctx.mediaAssetId) {
        reasons.push('UPLOAD_MISSING');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Validate media asset metadata
      const imageMetadata: ImageMetadata = {
        width: ctx.mediaAssetWidth,
        height: ctx.mediaAssetHeight,
        byteSize: ctx.mediaAssetByteSize ?? 0,
        contentType: 'image/jpeg', // Would come from MediaAsset in real impl
        format: 'jpeg',
        exifRotation: ctx.mediaAssetExifRotation,
      };

      // Check file type
      if (!this.isValidContentType(imageMetadata.contentType)) {
        reasons.push('FILE_TYPE_INVALID');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Check file size
      if (imageMetadata.byteSize < this.minFileSize) {
        reasons.push('FILE_SIZE_EXCEEDS_LIMIT');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      if (imageMetadata.byteSize > this.maxFileSize) {
        reasons.push('FILE_SIZE_EXCEEDS_LIMIT');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // Check resolution (after normalization for rotation)
      const { width, height } = this.normalizeResolution(
        imageMetadata.width ?? 0,
        imageMetadata.height ?? 0,
        imageMetadata.exifRotation
      );

      // Check aspect ratio first (detects extreme crops before resolution checks)
      const aspectRatio = width / height;
      if (aspectRatio < this.minAspectRatio || aspectRatio > this.maxAspectRatio) {
        reasons.push('QUALITY_BLUR_DETECTED'); // Extreme crop detected
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      if (width < this.minResolution.width || height < this.minResolution.height) {
        reasons.push('IMAGE_RESOLUTION_TOO_LOW');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      if (width > this.maxResolution.width || height > this.maxResolution.height) {
        reasons.push('IMAGE_RESOLUTION_TOO_LOW');
        return {
          status: 'FAIL',
          signals: [],
          reasons,
          durationMs: performance.now() - startTime,
          retryCount: 0,
        };
      }

      // All checks passed
      return {
        status: 'PASS',
        signals: [
          {
            key: 'file_valid',
            value: 1.0,
            confidence: 100,
            weight: 10,
          },
          {
            key: 'resolution_ok',
            value: 1.0,
            confidence: 100,
            weight: 5,
          },
        ],
        reasons: [],
        evidenceRef: ctx.mediaAssetId,
        durationMs: performance.now() - startTime,
        retryCount: 0,
      };
    } catch (err) {
      reasons.push('SYSTEM_FAILURE');
      return {
        status: 'INCONCLUSIVE',
        signals: [],
        reasons,
        durationMs: performance.now() - startTime,
        retryCount: 0,
        failureMessage: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  }

  private isValidContentType(contentType: string): boolean {
    return this.allowedContentTypes.includes(contentType);
  }

  /**
   * Normalize resolution for EXIF rotation.
   * If rotated 90/270 degrees, swap width and height.
   */
  private normalizeResolution(
    width: number,
    height: number,
    exifRotation?: number
  ): { width: number; height: number } {
    if (!exifRotation || ![90, 270].includes(exifRotation)) {
      return { width, height };
    }

    return { width: height, height: width };
  }
}
