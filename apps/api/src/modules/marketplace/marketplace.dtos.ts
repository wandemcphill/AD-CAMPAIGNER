export interface ApplyAsAgencyDto {
  name: string;
  specialty: string;
  location: string;
  description: string;
  packages?: string[];
}

export interface ApplyAsCreatorDto {
  name: string;
  niche: string;
  bio: string;
  followerCount?: number;
  languages?: string[];
  platforms?: string[];
  rateMinor?: number;
}

export interface ReviewApplicationDto {
  decision: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}
