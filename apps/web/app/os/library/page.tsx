"use client";

import { useEffect, useState } from "react";
import { Download, Film, FileText, Image, RefreshCw, Search, Upload } from "lucide-react";
import { motion } from "framer-motion";

import { Badge, Button } from "@fliptrybe/ui";
import { TabBar } from "@fliptrybe/ui/components";

import { EmptyState, ErrorNotice, LoadingBlock } from "../../campaigns/components";
import {
  assetDimensions,
  formatByteSize,
  loadMediaAssets,
  type MediaAssetKind,
  type MediaAssetRecord
} from "../../library/api";

const CATEGORY_TABS = [
  { id: "all", label: "All" },
  { id: "IMAGE", label: "Images" },
  { id: "VIDEO", label: "Videos" },
  { id: "SCREENSHOT", label: "Screenshots" },
  { id: "REPORT_ATTACHMENT", label: "Reports" },
];

const catIcon: Record<MediaAssetKind, typeof Image> = {
  IMAGE: Image,
  VIDEO: Film,
  SCREENSHOT: Image,
  REPORT_ATTACHMENT: FileText,
  OTHER: FileText
};

export default function CreativeLibraryPage() {
  const [cat, setCat] = useState("all");
  const [search, setSearch] = useState("");
  const [assets, setAssets] = useState<MediaAssetRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  async function refresh() {
    setError(undefined);
    try {
      setAssets(await loadMediaAssets(cat === "all" ? undefined : cat));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Creative library failed to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    void refresh();
  }, [cat]);

  const filtered = assets.filter((asset) => {
    if (!search) return true;
    return (asset.originalFilename ?? "").toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold">Creative Library</h1>
          <p className="text-sm text-[var(--ft-text-secondary)]">
            {loading ? "Loading..." : `${assets.length} asset${assets.length === 1 ? "" : "s"} uploaded to this workspace`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button disabled={loading} onClick={() => void refresh()} variant="secondary">
            <RefreshCw className="size-4" /> Refresh
          </Button>
          <Button disabled title="Upload flow is not wired into this view yet">
            <Upload className="size-4" /> Upload
          </Button>
        </div>
      </div>

      <ErrorNotice message={error} />

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <TabBar items={CATEGORY_TABS} onChange={setCat} value={cat} />
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-[var(--ft-text-muted)]" />
          <input
            className="h-9 w-56 rounded-[var(--radius-md)] border border-[var(--ft-border)] bg-[var(--ft-bg-surface)] pl-9 pr-3 text-sm outline-none placeholder:text-[var(--ft-text-muted)] focus:border-[var(--ft-accent)]"
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by filename..."
            value={search}
          />
        </div>
      </div>

      {loading ? (
        <div className="mt-4">
          <LoadingBlock label="Loading assets" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            copy="Assets uploaded to campaign creatives or reports will appear here."
            icon={Image}
            title="No assets yet"
          />
        </div>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtered.map((asset, i) => {
            const Icon = catIcon[asset.kind] ?? FileText;
            const preview = asset.thumbnailUrl ?? (asset.kind === "IMAGE" ? asset.secureUrl ?? asset.url : undefined);

            return (
              <motion.div
                animate={{ opacity: 1, scale: 1 }}
                className="group rounded-[var(--radius-lg)] border border-[var(--ft-border)] bg-[var(--ft-bg-raised)] transition hover:border-[var(--ft-accent)]/30 hover:shadow-[var(--shadow-md)]"
                initial={{ opacity: 0, scale: 0.97 }}
                key={asset.id}
                transition={{ delay: i * 0.02 }}
              >
                <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-t-[var(--radius-lg)] bg-[var(--ft-bg-muted)]">
                  {preview ? (
                    <img alt={asset.originalFilename ?? "Asset preview"} className="size-full object-cover" src={preview} />
                  ) : (
                    <Icon className="size-8 text-[var(--ft-text-muted)] transition group-hover:text-[var(--ft-accent)]" />
                  )}
                  {(asset.url ?? asset.secureUrl) ? (
                    <a
                      className="absolute right-2 top-2 grid size-7 place-items-center rounded-full bg-[var(--ft-bg-raised)] opacity-0 shadow transition group-hover:opacity-100"
                      href={asset.secureUrl ?? asset.url ?? undefined}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <Download className="size-3.5 text-[var(--ft-text-muted)]" />
                    </a>
                  ) : null}
                  <span className="absolute bottom-2 left-2">
                    <Badge tone="neutral">{asset.format ?? asset.contentType.split("/")[1]?.toUpperCase() ?? "FILE"}</Badge>
                  </span>
                </div>
                <div className="p-3">
                  <div className="truncate text-sm font-medium">
                    {asset.originalFilename ?? "Untitled asset"}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[10px] text-[var(--ft-text-muted)]">
                    <span>{assetDimensions(asset)}</span>
                    <span>{formatByteSize(asset.byteSize)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
