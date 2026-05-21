export interface DatabaseHealth {
  status: "ok" | "degraded";
  checkedAt: string;
}

export function createDatabaseHealth(status: DatabaseHealth["status"] = "ok"): DatabaseHealth {
  return {
    status,
    checkedAt: new Date().toISOString()
  };
}
