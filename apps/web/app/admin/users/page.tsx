"use client";

import { useState } from "react";
import { MoreHorizontal, Search, Shield, UserCircle } from "lucide-react";

import { Badge, Button } from "@fliptrybe/ui";
import { Drawer, TabBar } from "@fliptrybe/ui/components";

type User = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  status: "active" | "suspended" | "pending";
  joined: string;
  lastActive: string;
  campaigns: number;
  spent: string;
};

const MOCK_USERS: User[] = [
  { id: "1", username: "tunde_o", displayName: "Tunde Okoro", role: "admin", status: "active", joined: "2024-11-15", lastActive: "Today", campaigns: 12, spent: "₦842K" },
  { id: "2", username: "amara_k", displayName: "Amara Kalu", role: "member", status: "active", joined: "2025-01-20", lastActive: "2 hours ago", campaigns: 8, spent: "₦320K" },
  { id: "3", username: "chi_design", displayName: "Chi Studios", role: "member", status: "active", joined: "2025-03-05", lastActive: "Yesterday", campaigns: 24, spent: "₦1.2M" },
  { id: "4", username: "segun_b", displayName: "Segun Balogun", role: "member", status: "suspended", joined: "2025-02-10", lastActive: "5 days ago", campaigns: 2, spent: "₦18K" },
  { id: "5", username: "nneka_m", displayName: "Nneka Mgbemena", role: "member", status: "pending", joined: "2025-07-28", lastActive: "Never", campaigns: 0, spent: "₦0" },
];

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  suspended: "danger",
  pending: "warning",
};

const TABS = [
  { id: "all", label: "All", count: 5 },
  { id: "active", label: "Active", count: 3 },
  { id: "suspended", label: "Suspended", count: 1 },
  { id: "pending", label: "Pending", count: 1 },
];

export default function UsersPage() {
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<User>();

  const filtered = MOCK_USERS.filter((u) => {
    if (tab !== "all" && u.status !== tab) return false;
    if (search && !u.displayName.toLowerCase().includes(search.toLowerCase()) && !u.username.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold">User Management</h1>
      <p className="mt-1 text-sm text-[var(--ft-text-secondary)]">Directory of all platform users</p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <TabBar items={TABS} onChange={setTab} value={tab} />
        <div className="relative ml-auto">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            className="h-9 w-64 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none focus:border-[var(--ft-accent)]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search users..."
            value={search}
          />
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-[var(--radius-lg)] border border-[var(--ft-border)]">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--ft-border)] bg-[var(--ft-bg-surface)]">
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">User</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Role</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Status</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Campaigns</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Spent</th>
              <th className="px-4 py-3 text-left font-medium text-[var(--ft-text-muted)]">Last active</th>
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--ft-border)]">
            {filtered.map((user) => (
              <tr
                className="cursor-pointer bg-[var(--ft-bg-raised)] transition hover:bg-[var(--ft-bg-muted)]"
                key={user.id}
                onClick={() => setSelectedUser(user)}
              >
                <td className="px-4 py-3">
                  <div className="font-medium">{user.displayName}</div>
                  <div className="text-xs text-[var(--ft-text-muted)]">@{user.username}</div>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5">
                    {user.role === "admin" && <Shield className="size-3.5 text-[var(--ft-accent)]" />}
                    {user.role}
                  </span>
                </td>
                <td className="px-4 py-3"><Badge tone={STATUS_TONE[user.status] ?? "neutral"}>{user.status}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs">{user.campaigns}</td>
                <td className="px-4 py-3 font-mono text-xs">{user.spent}</td>
                <td className="px-4 py-3 text-[var(--ft-text-muted)]">{user.lastActive}</td>
                <td className="px-4 py-3"><MoreHorizontal className="size-4 text-[var(--ft-text-muted)]" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* User detail drawer */}
      <Drawer onClose={() => setSelectedUser(undefined)} open={Boolean(selectedUser)} title="User Details">
        {selectedUser && (
          <div className="grid gap-6">
            <div className="flex items-center gap-4">
              <div className="grid size-14 place-items-center rounded-full bg-[var(--ft-bg-muted)]">
                <UserCircle className="size-7 text-[var(--ft-text-muted)]" />
              </div>
              <div>
                <div className="text-lg font-bold">{selectedUser.displayName}</div>
                <div className="text-sm text-[var(--ft-text-muted)]">@{selectedUser.username}</div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {[
                { label: "Role", value: selectedUser.role },
                { label: "Status", value: selectedUser.status },
                { label: "Joined", value: selectedUser.joined },
                { label: "Last active", value: selectedUser.lastActive },
                { label: "Campaigns", value: String(selectedUser.campaigns) },
                { label: "Total spent", value: selectedUser.spent },
              ].map((item) => (
                <div className="rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] p-3" key={item.label}>
                  <div className="text-xs text-[var(--ft-text-muted)]">{item.label}</div>
                  <div className="mt-1 font-medium">{item.value}</div>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <Button className="flex-1 justify-center" variant="secondary">
                {selectedUser.status === "suspended" ? "Reactivate" : "Suspend"}
              </Button>
              <Button className="flex-1 justify-center">Message</Button>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
}
