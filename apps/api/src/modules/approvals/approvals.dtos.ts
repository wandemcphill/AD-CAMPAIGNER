// Query/body shapes for the unified Approvals Queue controller. The underlying
// ApprovalRequest model (packages/database/prisma/schema.prisma) is generic —
// `entityType` is a free-form string set by whichever domain called
// ApprovalsService.request() (e.g. "digital_access_refund"). The `type` filter
// here is a coarse client-facing grouping over that field, not a DB enum.

export type ApprovalQueueStatusFilter = "pending" | "flagged" | "all";
export type ApprovalQueueTypeFilter = "ads" | "kyc" | "smm" | "all";

export interface ApprovalQueueListQueryDto {
  status?: ApprovalQueueStatusFilter;
  type?: ApprovalQueueTypeFilter;
}

export interface ApprovalDecisionDto {
  approve: boolean;
  note?: string;
}
