"use client";

import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutGrid, Table, GitBranch, RefreshCw, Filter,
  Search, X,
} from "lucide-react";
import { Panel, Stat, Badge, Empty } from "@/components/ui/primitives";
import { BrainCard, VendorIcon, BrainStatusDot } from "@/components/brain-card";
import { BrainDetail } from "@/components/brain-detail";
import { BrainConstellationView } from "@/components/mission-control/BrainConstellationView";
import type { BrainRecord, BrainRelationship, BrainStatus, BrainType, BrainVendor, BrainRuntime } from "@/types/missionControl";
import { brainStatusToColor, BRAIN_STATUSES, BRAIN_TYPES, BRAIN_VENDORS } from "@/lib/brainsData";
import { safeFixed, safeNum } from "@/lib/safe";

interface BrainsRegistryViewProps {
  brains: BrainRecord[];
  relationships: BrainRelationship[];
  onRescan: () => Promise<void>;
  isRescanning?: boolean;
  selectedBrain?: BrainRecord | null;
  onSelectBrain?: (brain: BrainRecord | null) => void;
  connected?: boolean;
}

export function BrainsRegistryView({
  brains,
  relationships,
  onRescan,
  isRescanning = false,
  selectedBrain: externalSelectedBrain,
  onSelectBrain: externalOnSelectBrain,
  connected = true,
}: BrainsRegistryViewProps) {
  const [internalSelectedBrainId, setInternalSelectedBrainId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"card" | "table" | "graph">("card");
  const [expandedBrains, setExpandedBrains] = useState<Record<string, boolean>>({});
  const [showFilters, setShowFilters] = useState(true);

  // Local filter state matching the original cloned repo
  const [filter, setFilterState] = useState<{
    search: string;
    status: BrainStatus[];
    type: BrainType[];
    vendor: BrainVendor[];
    runtime: BrainRuntime[];
    sort: "display_name" | "status" | "health" | "cpu_usage" | "memory_usage" | "latency";
    sortDir: "asc" | "desc";
    groupBy: "none" | "type" | "vendor" | "status" | "health" | "runtime";
  }>({
    search: "",
    status: [],
    type: [],
    vendor: [],
    runtime: [],
    sort: "display_name",
    sortDir: "asc",
    groupBy: "none",
  });

  const setFilter = (patch: Partial<typeof filter>) => {
    setFilterState((prev) => ({ ...prev, ...patch }));
  };

  const resetFilter = () => {
    setFilterState({
      search: "",
      status: [],
      type: [],
      vendor: [],
      runtime: [],
      sort: "display_name",
      sortDir: "asc",
      groupBy: "none",
    });
  };

  const selectedBrainId = externalSelectedBrain ? externalSelectedBrain.id : internalSelectedBrainId;
  const setSelectedBrainId = (id: string | null) => {
    setInternalSelectedBrainId(id);
    if (externalOnSelectBrain) {
      const found = id ? brains.find((b) => b.id === id) ?? null : null;
      externalOnSelectBrain(found);
    }
  };

  const selectedBrainRecord = useMemo(() => {
    return brains.find((b) => b.id === selectedBrainId) ?? null;
  }, [brains, selectedBrainId]);

  const toggleExpand = (id: string) => {
    setExpandedBrains((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleStatusFilter = (status: BrainStatus) => {
    setFilterState((prev) => {
      const exists = prev.status.includes(status);
      return {
        ...prev,
        status: exists ? prev.status.filter((s) => s !== status) : [...prev.status, status],
      };
    });
  };

  // Filter and sort brains
  const filteredBrains = useMemo(() => {
    let result = [...brains];

    if (filter.search) {
      const query = filter.search.toLowerCase();
      result = result.filter(
        (b) =>
          b.display_name.toLowerCase().includes(query) ||
          b.id.toLowerCase().includes(query) ||
          b.vendor.toLowerCase().includes(query) ||
          b.tags.some((t) => t.toLowerCase().includes(query)) ||
          b.capabilities.some((c) => c.toLowerCase().includes(query))
      );
    }

    if (filter.status.length > 0) {
      result = result.filter((b) => filter.status.includes(b.status));
    }
    if (filter.type.length > 0) {
      result = result.filter((b) => filter.type.includes(b.brain_type));
    }
    if (filter.vendor.length > 0) {
      result = result.filter((b) => filter.vendor.includes(b.vendor));
    }

    result.sort((a, b) => {
      const fieldA = a[filter.sort];
      const fieldB = b[filter.sort];
      const modifier = filter.sortDir === "asc" ? 1 : -1;
      if (typeof fieldA === "string" && typeof fieldB === "string") {
        return fieldA.localeCompare(fieldB) * modifier;
      }
      return ((fieldA as number) - (fieldB as number)) * modifier;
    });

    return result;
  }, [brains, filter]);

  // Grouped brains
  const groupedBrains = useMemo(() => {
    if (filter.groupBy === "none") {
      return { "All Brains": filteredBrains };
    }
    const map: Record<string, BrainRecord[]> = {};
    for (const brain of filteredBrains) {
      const key =
        filter.groupBy === "type"
          ? brain.brain_type
          : filter.groupBy === "vendor"
          ? brain.vendor
          : filter.groupBy === "status"
          ? brain.status
          : filter.groupBy === "health"
          ? brain.health
          : brain.runtime;
      if (!map[key]) map[key] = [];
      map[key].push(brain);
    }
    return map;
  }, [filteredBrains, filter.groupBy]);

  // Stats calculation
  const totalBrains = brains.length;
  const activeCount = brains.filter((b) =>
    ["connected", "executing", "busy", "healthy"].includes(b.status)
  ).length;
  const healthyCount = brains.filter((b) => b.health === "healthy").length;
  const degradedCount = brains.filter((b) => b.health === "degraded").length;
  const unhealthyCount = brains.filter((b) => b.health === "unhealthy").length;

  const activeFilterCount =
    filter.status.length +
    filter.type.length +
    filter.vendor.length +
    (filter.search ? 1 : 0);

  return (
    <div
      className="grid h-full gap-4 p-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))" }}
    >
      {/* ── Left sidebar ── */}
      <div className="min-w-[280px] flex flex-col gap-4">
        {/* Stats */}
        <Panel title="Brain Registry" className="flex-shrink-0">
          <div className="space-y-2">
            <Stat label="Total Brains" value={totalBrains} />
            <Stat label="Active" value={activeCount} tone="ok" />
            <Stat
              label="Healthy / Degraded / Unhealthy"
              value={
                <div className="flex items-center gap-2">
                  <span className="text-ok">{healthyCount}</span>
                  <span className="text-faint">/</span>
                  <span className="text-warn">{degradedCount}</span>
                  <span className="text-faint">/</span>
                  <span className="text-danger">{unhealthyCount}</span>
                </div>
              }
            />
            <Stat label="Filtered" value={filteredBrains.length} />
          </div>
        </Panel>

        {/* View mode & Actions */}
        <Panel title="View" className="flex-shrink-0">
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-1.5">
              {[
                { id: "card" as const, icon: <LayoutGrid size={14} />, label: "Cards" },
                { id: "table" as const, icon: <Table size={14} />, label: "Table" },
                { id: "graph" as const, icon: <GitBranch size={14} />, label: "Graph" },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => setViewMode(item.id)}
                  className={`flex items-center justify-center gap-1.5 rounded-lg px-2.5 py-2 text-[10px] font-medium transition ${
                    viewMode === item.id
                      ? "bg-accent/20 text-accent border border-accent/30"
                      : "text-faint hover:text-text hover:bg-surface/20 border border-transparent"
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              ))}
            </div>

            <button
              onClick={() => onRescan()}
              disabled={isRescanning}
              className="w-full flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-medium bg-surface/20 hover:bg-surface/40 transition disabled:opacity-50"
            >
              <RefreshCw size={14} className={isRescanning ? "animate-spin" : ""} />
              {isRescanning ? "Scanning..." : "Rescan Brains"}
            </button>
          </div>
        </Panel>

        {/* Filters */}
        <div className="flex-shrink-0">
          <div className="flex items-center justify-between mb-2 px-0.5">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm font-semibold"
            >
              <Filter size={14} />
              Filters
              {activeFilterCount > 0 && (
                <Badge tone="accent">{activeFilterCount}</Badge>
              )}
            </button>
          </div>
          <section className="panel flex min-h-0 flex-col">
            <div className="min-h-0 flex-1 overflow-auto p-3 space-y-3">
              {/* Search */}
              <div>
                <label className="text-[10px] font-medium text-faint">Search</label>
                <div className="mt-1 relative">
                  <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    type="text"
                    placeholder="Search brains..."
                    value={filter.search}
                    onChange={(e) => setFilter({ search: e.target.value })}
                    className="w-full rounded-lg border border-border/40 bg-surface/10 pl-8 pr-2.5 py-1.5 text-[11px] focus:border-accent/50 focus:outline-none text-text"
                  />
                  {filter.search && (
                    <button
                      onClick={() => setFilter({ search: "" })}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-faint hover:text-text"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-[10px] font-medium text-faint">Sort By</label>
                <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-1">
                  {[
                    { id: "display_name", label: "Name" },
                    { id: "status", label: "Status" },
                    { id: "health", label: "Health" },
                    { id: "cpu_usage", label: "CPU" },
                    { id: "memory_usage", label: "Memory" },
                    { id: "latency", label: "Latency" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setFilter({ sort: item.id as any })}
                      className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                        filter.sort === item.id
                          ? "bg-accent/20 text-accent"
                          : "text-faint hover:text-text hover:bg-surface/20"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 flex gap-1">
                  <button
                    onClick={() => setFilter({ sortDir: "asc" })}
                    className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                      filter.sortDir === "asc"
                        ? "bg-accent/20 text-accent"
                        : "text-faint hover:text-text hover:bg-surface/20"
                    }`}
                  >
                    Asc
                  </button>
                  <button
                    onClick={() => setFilter({ sortDir: "desc" })}
                    className={`flex-1 rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                      filter.sortDir === "desc"
                        ? "bg-accent/20 text-accent"
                        : "text-faint hover:text-text hover:bg-surface/20"
                    }`}
                  >
                    Desc
                  </button>
                </div>
              </div>

              {/* Group By */}
              <div>
                <label className="text-[10px] font-medium text-faint">Group By</label>
                <div className="mt-1 grid grid-cols-1 md:grid-cols-2 gap-1">
                  {[
                    { id: "none", label: "None" },
                    { id: "type", label: "Type" },
                    { id: "vendor", label: "Vendor" },
                    { id: "status", label: "Status" },
                    { id: "health", label: "Health" },
                  ].map((item) => (
                    <button
                      key={item.id}
                      onClick={() => setFilter({ groupBy: item.id as any })}
                      className={`rounded-lg px-2 py-1 text-[10px] font-medium transition ${
                        filter.groupBy === item.id
                          ? "bg-accent/20 text-accent"
                          : "text-faint hover:text-text hover:bg-surface/20"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Collapsible advanced filters */}
              {showFilters && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="space-y-3 pt-2 border-t border-border/30"
                >
                  {/* Status filter */}
                  <div>
                    <label className="text-[10px] font-medium text-faint">Status</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {BRAIN_STATUSES.slice(0, 10).map((s) => (
                        <button
                          key={s}
                          onClick={() => toggleStatusFilter(s)}
                          className={`rounded-lg px-2 py-0.5 text-[9px] font-medium transition ${
                            filter.status.includes(s)
                              ? "bg-accent/20 text-accent border border-accent/30"
                              : "text-faint hover:text-text border border-transparent"
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                      {filter.status.length > 0 && (
                        <button
                          onClick={() => setFilter({ status: [] })}
                          className="rounded-lg px-2 py-0.5 text-[9px] text-danger hover:bg-danger/10"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Vendor filter */}
                  <div>
                    <label className="text-[10px] font-medium text-faint">Vendor</label>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {BRAIN_VENDORS.slice(0, 12).map((v) => (
                        <button
                          key={v}
                          onClick={() => {
                            const current = filter.vendor;
                            const next = current.includes(v)
                              ? current.filter((x) => x !== v)
                              : [...current, v];
                            setFilter({ vendor: next });
                          }}
                          className={`rounded-lg px-2 py-0.5 text-[9px] font-medium transition ${
                            filter.vendor.includes(v)
                              ? "bg-accent/20 text-accent border border-accent/30"
                              : "text-faint hover:text-text border border-transparent"
                          }`}
                        >
                          {v}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Reset */}
              {activeFilterCount > 0 && (
                <button
                  onClick={resetFilter}
                  className="w-full rounded-lg px-3 py-1.5 text-[10px] font-medium text-faint hover:text-text hover:bg-surface/20 transition"
                >
                  Reset all filters
                </button>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Main content ── */}
      <div className="min-w-[400px] flex flex-col gap-4 h-full min-h-0">
        {/* Connection status bar */}
        <div
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-medium ${
            connected ? "bg-ok/10 text-ok" : "bg-danger/10 text-danger"
          }`}
        >
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              connected ? "bg-ok animate-pulse" : "bg-danger"
            }`}
          />
          <span>{connected ? "SSE connected — live updates active" : "SSE disconnected"}</span>
          <span className="ml-auto text-faint">{brains.length} brains discovered</span>
        </div>

        {/* Table mode */}
        {viewMode === "table" && (
          <Panel title="Brains" subtitle="Table view" className="flex-1 min-h-0">
            {filteredBrains.length === 0 ? (
              <Empty title="No brains match filters" hint="Try adjusting your filters or search query" />
            ) : (
              <div className="overflow-auto h-full">
                <table className="w-full text-xs block overflow-x-auto">
                  <thead>
                    <tr className="border-b border-border/30 text-[10px] text-faint uppercase tracking-wider">
                      <th className="text-left py-2 px-2 font-medium">Name</th>
                      <th className="text-left py-2 px-2 font-medium">Type</th>
                      <th className="text-left py-2 px-2 font-medium">Vendor</th>
                      <th className="text-left py-2 px-2 font-medium">Status</th>
                      <th className="text-left py-2 px-2 font-medium">Health</th>
                      <th className="text-right py-2 px-2 font-medium">CPU</th>
                      <th className="text-right py-2 px-2 font-medium">Memory</th>
                      <th className="text-right py-2 px-2 font-medium">Latency</th>
                      <th className="text-right py-2 px-2 font-medium">Tasks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBrains.map((brain) => (
                      <TableRow
                        key={brain.id}
                        brain={brain}
                        onClick={() => setSelectedBrainId(brain.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        )}

        {/* Graph mode */}
        {viewMode === "graph" && (
          <Panel title="Constellation" subtitle="Graph view" className="flex-1 min-h-0" contentClassName="p-2">
            {brains.length === 0 ? (
              <Empty title="No brains to display" hint="Run a discovery scan to find brains" />
            ) : (
              <BrainConstellationView
                brains={brains}
                relationships={relationships}
                selectedBrain={selectedBrainRecord}
                onSelectBrain={(b) => setSelectedBrainId(b ? b.id : null)}
              />
            )}
          </Panel>
        )}

        {/* Card mode */}
        {viewMode === "card" && (
          <Panel title="Brains" subtitle="Card view" className="flex-1 min-h-0">
            {filteredBrains.length === 0 ? (
              <div className="p-4">
                <Empty title="No brains match filters" hint="Try adjusting your filters or search query" />
              </div>
            ) : (
              <div className="overflow-y-auto h-full p-2">
                {Object.entries(groupedBrains).map(([group, groupList]) => {
                  const list = groupList as BrainRecord[];
                  return (
                    <div key={group} className="mb-6">
                      {filter.groupBy !== "none" && (
                        <div className="flex items-center gap-2 mb-3 px-1">
                          <h3 className="text-xs font-semibold capitalize text-faint">{group}</h3>
                          <span className="text-[10px] text-faint/50">({list.length})</span>
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {list.map((brain: BrainRecord) => (
                          <BrainCard
                            key={brain.id}
                            brain={brain}
                            expanded={expandedBrains[brain.id] ?? false}
                            onToggle={() => toggleExpand(brain.id)}
                            onSelect={() => setSelectedBrainId(brain.id)}
                            onRefresh={() => onRescan()}
                          />
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Panel>
        )}
      </div>

      {/* ── Detail panel (slide-over) ── */}
      <AnimatePresence>
        {selectedBrainRecord && (
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 200 }}
            className="fixed inset-y-0 right-0 z-50 w-full max-w-2xl border-l border-border/40 bg-surface shadow-2xl"
          >
            <BrainDetail
              brain={selectedBrainRecord}
              relationships={relationships.filter(
                (r) => r.source_id === selectedBrainRecord.id || r.target_id === selectedBrainRecord.id
              )}
              onClose={() => setSelectedBrainId(null)}
              onRefresh={() => onRescan()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Table Row ───────────────────────────────────────────────────────────────

function TableRow({ brain, onClick }: { brain: BrainRecord; onClick: () => void; key?: any }) {
  const statusColor = brainStatusToColor(brain.status);

  return (
    <tr
      className="border-b border-border/20 hover:bg-surface/20 transition cursor-pointer"
      onClick={onClick}
    >
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-2">
          <VendorIcon vendor={brain.vendor} size={16} />
          <span className="font-medium text-text">{brain.display_name}</span>
        </div>
      </td>
      <td className="py-2.5 px-2 text-faint">{brain.brain_type}</td>
      <td className="py-2.5 px-2 text-faint">{brain.vendor}</td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-text">{brain.status}</span>
        </div>
      </td>
      <td className="py-2.5 px-2">
        <BrainStatusDot status={String(brain.health || 'healthy')} />
        <span className="ml-1.5 capitalize text-[11px] text-faint">{brain.health}</span>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums">
        <span className={brain.cpu_usage > 80 ? "text-danger" : brain.cpu_usage > 50 ? "text-warn" : "text-text"}>
          {safeFixed(brain?.cpu_usage, 0)}%
        </span>
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums text-faint">
        {safeFixed((safeNum(brain?.memory_usage) / 1024), 1)}GB
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums text-faint">
        {safeFixed(brain?.latency, 0)}ms
      </td>
      <td className="py-2.5 px-2 text-right tabular-nums text-text">
        {brain.current_tasks}
      </td>
    </tr>
  );
}
