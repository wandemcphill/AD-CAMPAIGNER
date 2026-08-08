import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type { CreatePersonaDto, UpdatePersonaDto } from "./personas.dtos";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }

  return context;
}

@Injectable()
export class PersonasService {
  constructor(private readonly prisma: PrismaService) {}

  private get db() {
    return this.prisma.client;
  }

  async list(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    return this.db.persona.findMany({
      where: { workspaceId: scope.workspaceId, deletedAt: null },
      orderBy: { createdAt: "desc" }
    });
  }

  async create(input: CreatePersonaDto, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);

    if (!input.name?.trim()) {
      throw new BadRequestException("A persona name is required.");
    }
    if (!input.role?.trim()) {
      throw new BadRequestException("A persona role is required.");
    }
    if (!["SYNTHETIC", "VERIFIED", "CAST"].includes(input.type)) {
      throw new BadRequestException("A valid persona type is required.");
    }

    return this.db.persona.create({
      data: {
        workspaceId: scope.workspaceId,
        createdByUserId: scope.userId,
        name: input.name.trim(),
        role: input.role.trim(),
        type: input.type,
        status: "DRAFT",
        hasVoice: input.hasVoice ?? false,
        hasMotion: input.hasMotion ?? false,
        ...(input.description === undefined ? {} : { description: input.description })
      }
    });
  }

  async update(id: string, input: UpdatePersonaDto, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const persona = await this.findOwned(id, scope.workspaceId);

    return this.db.persona.update({
      where: { id: persona.id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name.trim() }),
        ...(input.role === undefined ? {} : { role: input.role.trim() }),
        ...(input.status === undefined ? {} : { status: input.status }),
        ...(input.description === undefined ? {} : { description: input.description }),
        ...(input.hasVoice === undefined ? {} : { hasVoice: input.hasVoice }),
        ...(input.hasMotion === undefined ? {} : { hasMotion: input.hasMotion })
      }
    });
  }

  async markConsented(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const persona = await this.findOwned(id, scope.workspaceId);

    if (persona.consentedAt) {
      return persona;
    }

    const [updated] = await this.db.$transaction([
      this.db.persona.update({
        where: { id: persona.id },
        data: { consentedAt: new Date() }
      }),
      this.db.auditLog.create({
        data: {
          workspaceId: scope.workspaceId,
          actorUserId: scope.userId,
          action: "persona.consent_granted",
          entityType: "Persona",
          entityId: persona.id,
          metadata: {
            personaName: persona.name,
            personaType: persona.type,
            hasVoice: persona.hasVoice,
            hasMotion: persona.hasMotion
          }
        }
      })
    ]);

    return updated;
  }

  async remove(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const persona = await this.findOwned(id, scope.workspaceId);

    await this.db.persona.update({
      where: { id: persona.id },
      data: { deletedAt: new Date() }
    });

    return { ok: true };
  }

  private async findOwned(id: string, workspaceId: string) {
    const persona = await this.db.persona.findFirst({
      where: { id, workspaceId, deletedAt: null }
    });

    if (!persona) {
      throw new NotFoundException("Persona was not found in the active workspace.");
    }

    return persona;
  }
}
