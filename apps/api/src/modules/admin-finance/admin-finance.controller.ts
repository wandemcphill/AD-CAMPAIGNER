import { Controller, Get, Param, Query } from "@nestjs/common";

import { RequirePermissions } from "../authorization.decorators";
import { AdminFinanceService } from "./admin-finance.service";

@Controller("admin/finance")
@RequirePermissions("admin:access")
export class AdminFinanceController {
  constructor(private readonly finance: AdminFinanceService) {}

  @Get("payments")
  payments(
    @Query("q") q?: string,
    @Query("status") status?: "PENDING" | "REQUIRES_ACTION" | "COMPLETED" | "FAILED" | "CANCELLED",
    @Query("limit") limit?: string
  ) {
    return this.finance.listPayments({
      ...(q ? { q } : {}),
      ...(status ? { status } : {}),
      ...(limit ? { limit: Number(limit) } : {})
    });
  }

  @Get("payments/:id")
  payment(@Param("id") id: string) {
    return this.finance.getPayment(id);
  }
}
