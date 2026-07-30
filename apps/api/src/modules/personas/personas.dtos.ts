export type PersonaTypeDto = "SYNTHETIC" | "VERIFIED" | "CAST";
export type PersonaStatusDto = "DRAFT" | "ACTIVE" | "ARCHIVED";

export interface CreatePersonaDto {
  name: string;
  role: string;
  type: PersonaTypeDto;
  description?: string;
  hasVoice?: boolean;
  hasMotion?: boolean;
}

export interface UpdatePersonaDto {
  name?: string;
  role?: string;
  status?: PersonaStatusDto;
  description?: string;
  hasVoice?: boolean;
  hasMotion?: boolean;
}
