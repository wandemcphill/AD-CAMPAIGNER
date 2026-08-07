import { BadRequestException, Injectable, NotFoundException, UnauthorizedException } from "@nestjs/common";

import { PrismaService } from "../prisma.service";
import type { AuthenticatedRequestContext } from "../request-context";
import type {
  CreateSupportTicketDto,
  SupportTicketQueryDto,
  UpdateSupportTicketDto
} from "./support.dtos";

function requireScope(context?: AuthenticatedRequestContext) {
  if (!context?.workspaceId || !context.userId) {
    throw new UnauthorizedException("Authenticated workspace context is required.");
  }
  return context;
}

@Injectable()
export class SupportService {
  constructor(private readonly prismaService: PrismaService) {}

  private get db() {
    return this.prismaService.client;
  }

  async create(input: CreateSupportTicketDto, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    if (!input.subject?.trim()) throw new BadRequestException("A subject is required.");
    if (!input.body?.trim()) throw new BadRequestException("A message is required.");

    return this.db.supportTicket.create({
      data: {
        workspaceId: scope.workspaceId,
        requesterUserId: scope.userId,
        subject: input.subject.trim(),
        body: input.body.trim(),
        priority: input.priority ?? "NORMAL"
      }
    });
  }

  async list(context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    return this.db.supportTicket.findMany({
      where: { workspaceId: scope.workspaceId },
      include: { replies: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" }
    });
  }

  async get(id: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    const ticket = await this.db.supportTicket.findFirst({
      where: { id, workspaceId: scope.workspaceId },
      include: { replies: { orderBy: { createdAt: "asc" } } }
    });
    if (!ticket) throw new NotFoundException("Support ticket was not found.");
    return ticket;
  }

  async reply(id: string, body: string, context?: AuthenticatedRequestContext) {
    const scope = requireScope(context);
    if (!body?.trim()) throw new BadRequestException("A message is required.");

    const ticket = await this.db.supportTicket.findFirst({
      where: { id, workspaceId: scope.workspaceId }
    });
    if (!ticket) throw new NotFoundException("Support ticket was not found.");

    await this.db.supportTicketReply.create({
      data: { ticketId: ticket.id, authorUserId: scope.userId, authorType: "USER", body: body.trim() }
    });

    return this.db.supportTicket.update({
      where: { id: ticket.id },
      data: { status: ticket.status === "CLOSED" ? "OPEN" : ticket.status },
      include: { replies: { orderBy: { createdAt: "asc" } } }
    });
  }

  // ─── Admin ──────────────────────────────────────────────────────────────────

  async adminList(query: SupportTicketQueryDto = {}) {
    return this.db.supportTicket.findMany({
      where: {
        ...(query.status ? { status: query.status } : {}),
        ...(query.priority ? { priority: query.priority } : {})
      },
      include: { replies: { orderBy: { createdAt: "asc" } } },
      orderBy: { createdAt: "desc" },
      take: 200
    });
  }

  async adminUpdate(id: string, input: UpdateSupportTicketDto) {
    const ticket = await this.db.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Support ticket was not found.");

    return this.db.supportTicket.update({
      where: { id },
      data: {
        ...(input.status ? { status: input.status } : {}),
        ...(input.priority ? { priority: input.priority } : {})
      }
    });
  }

  async adminReply(id: string, body: string, adminUserId: string) {
    if (!body?.trim()) throw new BadRequestException("A message is required.");

    const ticket = await this.db.supportTicket.findUnique({ where: { id } });
    if (!ticket) throw new NotFoundException("Support ticket was not found.");

    await this.db.supportTicketReply.create({
      data: { ticketId: ticket.id, authorUserId: adminUserId, authorType: "ADMIN", body: body.trim() }
    });

    return this.db.supportTicket.update({
      where: { id: ticket.id },
      data: { status: "IN_PROGRESS" },
      include: { replies: { orderBy: { createdAt: "asc" } } }
    });
  }
}
