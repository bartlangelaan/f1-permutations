"use client";

import { useState, useMemo } from "react";
import {
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import type { CalculatedChartData, EntitySeries, ProjectionMap, TimelineSlot } from "@/lib/timeline";

// Custom tooltip
function ChartTooltip({
  active,
  payload,
  label,
  slots,
  selectedIdx,
  projections,
  entities,
}: any) {
  if (!active || !payload?.length) return null;
  const slotIdx = payload[0]?.payload?.idx;
  const slot = slots[slotIdx];
  const isFuture = slotIdx > selectedIdx;

  if (isFuture) {
    const slotData = projections?.[selectedIdx]?.[slotIdx];
    if (!slotData) return null;

    const withPositions = (entities as EntitySeries[])
      .map((e) => {
        const entry = slotData[e.id];
        if (!entry) return null;
        return { id: e.id, name: e.name, color: e.color, ...entry };
      })
      .filter(Boolean) as (EntitySeries & { minPts: number; maxPts: number; bestPos: number; worstPos: number })[];

    withPositions.sort((a, b) => a.bestPos - b.bestPos || b.maxPts - a.maxPts);

    if (!withPositions.length) return null;
    return (
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl max-w-xs">
        <div className="font-semibold text-zinc-200 mb-2">
          {slot?.fullLabel ?? label}
          <span className="ml-2 text-zinc-500">(projected)</span>
        </div>
        {withPositions.map((e) => (
          <div key={e.id} className="flex justify-between gap-4 py-0.5">
            <span className="flex items-center gap-1.5">
              <span className="text-zinc-500 tabular-nums w-10">
                {e.bestPos === e.worstPos ? `P${e.bestPos}` : `P${e.bestPos}–${e.worstPos}`}
              </span>
              <span style={{ color: e.color }}>{e.name}</span>
            </span>
            <span className="tabular-nums text-zinc-300">
              {Math.round(e.minPts)}–{Math.round(e.maxPts)}
            </span>
          </div>
        ))}
      </div>
    );
  }

  // Past slot: actual cumulative points + current position
  const entries = payload
    .filter((p: any) => p.value != null && !p.dataKey.endsWith("_floor") && !p.dataKey.endsWith("_delta"))
    .map((p: any) => ({ name: p.name, value: p.value, color: p.color }))
    .sort((a: any, b: any) => b.value - a.value);

  if (!entries.length) return null;
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl max-w-xs">
      <div className="font-semibold text-zinc-200 mb-2">{slot?.fullLabel ?? label}</div>
      {entries.map((e: any, i: number) => (
        <div key={e.name} className="flex justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5">
            <span className="text-zinc-500 tabular-nums w-6">P{i + 1}</span>
            <span style={{ color: e.color }}>{e.name}</span>
          </span>
          <span className="tabular-nums text-zinc-300">{Math.round(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

function buildChartData(
  slots: TimelineSlot[],
  entities: EntitySeries[],
  selectedIdx: number,
  isDriverMode: boolean
) {
  return slots.map((slot, i) => {
    const pt: Record<string, number | null | string> = {
      idx: i,
      label: slot.label,
    };

    for (const e of entities) {
      // Actual line: past slots only
      pt[e.id] = i <= selectedIdx ? (e.cumulativePoints[i] ?? null) : null;

      // Cone: from the selected slot forward
      if (i >= selectedIdx) {
        const base = e.cumulativePoints[selectedIdx] ?? 0;
        const additionalMax = slots
          .slice(selectedIdx + 1, i + 1)
          .reduce(
            (sum, s) =>
              sum + (isDriverMode ? s.maxDriverPoints : s.maxConstructorPoints),
            0
          );
        pt[`${e.id}_floor`] = base;
        pt[`${e.id}_delta`] = additionalMax;
      }
    }

    return pt;
  });
}

export function SeasonChart({ data }: { data: CalculatedChartData }) {
  const { slots, lastCompletedSlotIndex, drivers, constructors, driverProjections, constructorProjections } = data;
  const [selectedIdx, setSelectedIdx] = useState(lastCompletedSlotIndex);
  const [mode, setMode] = useState<"drivers" | "constructors">("drivers");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const isDriverMode = mode === "drivers";
  const allEntities = isDriverMode ? drivers : constructors;
  const entities = allEntities.filter((e) => !hiddenIds.has(e.id));
  const projections: ProjectionMap = isDriverMode ? driverProjections : constructorProjections;

  const chartData = useMemo(
    () => buildChartData(slots, entities, selectedIdx, isDriverMode),
    [slots, entities, selectedIdx, isDriverMode]
  );

  const currentSlot = slots[selectedIdx];
  const hasFuture = selectedIdx < slots.length - 1;

  function toggleEntity(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Tick formatter: show full label at race slots, abbreviated at sprint slots
  function xTickFormatter(label: string, index: number) {
    const s = slots[index];
    if (!s) return label;
    return s.type === "sprint" ? "·" : label;
  }

  // Get the last (projected) GP for legend info
  const lastSlotIdx = slots.length - 1;
  const lastSlot = slots[lastSlotIdx];
  const lastGpProjections: Record<string, any> | null =
    lastSlot && selectedIdx < lastSlotIdx ? projections[selectedIdx]?.[lastSlotIdx] : null;

  return (
    <div className="space-y-4">
      {/* Mode toggle + slot info */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg border border-zinc-700 p-0.5">
          {(["drivers", "constructors"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={[
                "rounded px-3 py-1 text-sm font-medium capitalize transition-colors",
                mode === m
                  ? "bg-red-600 text-white"
                  : "text-zinc-400 hover:text-zinc-200",
              ].join(" ")}
            >
              {m}
            </button>
          ))}
        </div>

        <div className="text-sm text-zinc-400">
          <span className="text-zinc-200 font-medium">{currentSlot?.fullLabel}</span>
          {hasFuture && (
            <span className="ml-2 text-zinc-600">
              · {slots.length - 1 - selectedIdx} event
              {slots.length - 1 - selectedIdx !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      </div>

      {/* Time-travel scrubber */}
      <div className="space-y-1">
        <input
          type="range"
          min={0}
          max={lastCompletedSlotIndex}
          value={selectedIdx}
          onChange={(e) => setSelectedIdx(Number(e.target.value))}
          className="w-full accent-red-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>{slots[0]?.fullLabel}</span>
          <span>{slots[lastCompletedSlotIndex]?.fullLabel}</span>
        </div>
      </div>

      {/* Chart + Legend */}
      <div className="flex gap-6">
        {/* Chart */}
        <div className="flex-1">
          <ResponsiveContainer width="100%" height={480}>
            <ComposedChart
              data={chartData}
              margin={{ top: 8, right: 16, bottom: 40, left: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
              <XAxis
                dataKey="label"
                tick={{ fill: "#71717a", fontSize: 10 }}
                tickFormatter={xTickFormatter}
                interval={0}
                angle={-45}
                textAnchor="end"
                height={48}
              />
              <YAxis
                tick={{ fill: "#71717a", fontSize: 11 }}
                width={40}
              />
              <Tooltip
                content={
                  <ChartTooltip
                    slots={slots}
                    selectedIdx={selectedIdx}
                    projections={projections}
                    entities={entities}
                  />
                }
                isAnimationActive={false}
              />

              {/* Future zone shading */}
              {hasFuture && (
                <ReferenceLine
                  x={currentSlot?.label}
                  stroke="#52525b"
                  strokeDasharray="4 2"
                  label={{
                    value: "now",
                    position: "insideTopRight",
                    fill: "#52525b",
                    fontSize: 10,
                  }}
                />
              )}

              {/* Cone areas: floor (transparent base) + delta (colored band) */}
              {hasFuture &&
                entities.flatMap((e) => [
                  <Area
                    key={`${e.id}_floor`}
                    type="monotone"
                    dataKey={`${e.id}_floor`}
                    stackId={`cone_${e.id}`}
                    fill="transparent"
                    stroke="none"
                    isAnimationActive={false}
                    legendType="none"
                    name={e.name}
                  />,
                  <Area
                    key={`${e.id}_delta`}
                    type="monotone"
                    dataKey={`${e.id}_delta`}
                    stackId={`cone_${e.id}`}
                    fill={e.color}
                    fillOpacity={0.1}
                    stroke={e.color}
                    strokeWidth={1}
                    strokeDasharray="5 3"
                    strokeOpacity={0.35}
                    isAnimationActive={false}
                    legendType="none"
                    name={e.name}
                  />,
                ])}

              {/* Actual progress lines */}
              {entities.map((e) => (
                <Line
                  key={e.id}
                  type="monotone"
                  dataKey={e.id}
                  name={e.name}
                  stroke={e.color}
                  strokeWidth={2}
                  dot={(props: any) => {
                    const s = slots[props.index];
                    if (!s || props.value == null) return <g key={props.index} />;
                    // Different dot shape for sprint vs race
                    return s.type === "sprint" ? (
                      <polygon
                        key={props.index}
                        points={`${props.cx},${props.cy - 4} ${props.cx + 3.5},${props.cy + 2} ${props.cx - 3.5},${props.cy + 2}`}
                        fill={e.color}
                        opacity={0.8}
                      />
                    ) : (
                      <circle
                        key={props.index}
                        cx={props.cx}
                        cy={props.cy}
                        r={2.5}
                        fill={e.color}
                        opacity={0.7}
                      />
                    );
                  }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Legend + Projected GP Info */}
        <div className="w-72 flex flex-col gap-4">
          {/* Entity toggles with inline projection */}
          <div className="space-y-2">
            <div className="text-xs font-semibold text-zinc-400">
              Legend{lastGpProjections && <span className="ml-1 font-normal text-zinc-600">· Projected {lastSlot?.fullLabel}</span>}
            </div>
            <div className="space-y-1">
              {allEntities.map((e) => {
                const hidden = hiddenIds.has(e.id);
                const proj = lastGpProjections?.[e.id];
                return (
                  <button
                    key={e.id}
                    onClick={() => toggleEntity(e.id)}
                    className={[
                      "w-full flex items-center gap-1.5 rounded px-2 py-1 text-xs transition-opacity hover:bg-zinc-800/50",
                      hidden ? "opacity-30" : "opacity-100",
                    ].join(" ")}
                  >
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ background: e.color }}
                    />
                    <span className="flex-1 text-left" style={{ color: e.color }}>{e.name}</span>
                    {proj && (
                      <span className="flex items-center gap-2 tabular-nums">
                        <span className="text-zinc-500">
                          {proj.bestPos === proj.worstPos
                            ? `P${proj.bestPos}`
                            : `P${proj.bestPos}–${proj.worstPos}`}
                        </span>
                        <span className="text-zinc-200 font-medium">
                          {Math.round(proj.minPts)}–{Math.round(proj.maxPts)}
                        </span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Symbol legend */}
          <div className="space-y-1 border-t border-zinc-800 pt-4 text-xs text-zinc-600">
            <div className="font-semibold text-zinc-400 mb-2">Symbols</div>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="10">
                <circle cx="7" cy="5" r="2.5" fill="#71717a" opacity="0.7" />
              </svg>
              Grand Prix
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="14" height="10">
                <polygon points="7,1 10.5,7 3.5,7" fill="#71717a" opacity="0.8" />
              </svg>
              Sprint
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="24" height="10">
                <line
                  x1="0" y1="5" x2="24" y2="5"
                  stroke="#71717a"
                  strokeWidth="1"
                  strokeDasharray="5 3"
                />
              </svg>
              Projected range
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
