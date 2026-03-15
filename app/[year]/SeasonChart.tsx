"use client";

import { useState, useMemo } from "react";
import { createParser, useQueryState } from "nuqs";
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
import type {
  CalculatedChartData,
  EntitySeries,
  LockInsight,
  ProjectionMap,
  TimelineRace,
} from "@/lib/calculate";
import { renderInsightText } from "@/lib/render-insight";

type StandingsRow = {
  id: string;
  name: string;
  color: string;
  minPos: number;
  maxPos: number;
  minPoints: number;
  maxPoints: number;
};

function formatPositionRange(minPos: number, maxPos: number): string {
  return minPos === maxPos ? `P${minPos}` : `P${minPos}–${maxPos}`;
}

function formatPointsRange(minPoints: number, maxPoints: number): string {
  const min = Math.round(minPoints);
  const max = Math.round(maxPoints);
  return min === max ? `${min}` : `${min}–${max}`;
}

function StandingsRows({
  rows,
  getInteraction,
}: {
  rows: StandingsRow[];
  getInteraction?: (row: StandingsRow) => { hidden: boolean; onClick: () => void };
}) {
  return rows.map((row) => {
    const interaction = getInteraction?.(row);
    const className = [
      "flex w-full items-center gap-1.5 py-0.5 text-xs",
      interaction ? "rounded px-2 transition-opacity hover:bg-zinc-800/50" : "",
      interaction && interaction.hidden ? "opacity-30" : "opacity-100",
    ].join(" ");

    const content = (
      <>
        <span className="text-zinc-500 tabular-nums w-16 text-left">{formatPositionRange(row.minPos, row.maxPos)}</span>
        <span className="flex-1 text-left" style={{ color: row.color }}>{row.name}</span>
        <span className="tabular-nums text-zinc-300">{formatPointsRange(row.minPoints, row.maxPoints)}</span>
      </>
    );

    return interaction ? (
      <button key={row.id} onClick={interaction.onClick} className={className}>
        {content}
      </button>
    ) : (
      <div key={row.id} className={className}>
        {content}
      </div>
    );
  });
}

function getStandingsRowsForRace({
  entities,
  projections,
  afterRaceNum,
  raceNum,
}: {
  entities: EntitySeries[];
  projections: ProjectionMap;
  afterRaceNum: number;
  raceNum: number;
}): { rows: StandingsRow[]; isProjected: boolean } {
  if (raceNum > afterRaceNum) {
    const raceData = projections?.[afterRaceNum]?.[raceNum];
    if (!raceData) return { rows: [], isProjected: true };

    const projectedRows = entities.reduce<(StandingsRow & { sortPos: number; sortPts: number })[]>((acc, e) => {
      const entry = raceData[e.id];
      if (!entry) return acc;
      acc.push({
        id: e.id,
        name: e.name,
        color: e.color,
        minPos: entry.bestPos,
        maxPos: entry.worstPos ?? entities.length,
        minPoints: entry.minPts,
        maxPoints: entry.maxPts,
        sortPos: entry.bestPos,
        sortPts: entry.maxPts,
      });
      return acc;
    }, []);

    projectedRows.sort((a, b) => a.sortPos - b.sortPos || b.sortPts - a.sortPts);
    return {
      isProjected: true,
      rows: projectedRows.map(({ sortPos, sortPts, ...row }) => row),
    };
  }

  const actualRows = entities.reduce<{ id: string; name: string; color: string; points: number; pos: number }[]>((acc, e) => {
    const points = e.cumulativePoints[raceNum - 1];
    const pos = e.currentPos[raceNum - 1];
    if (points == null || pos == null) return acc;
    acc.push({
      id: e.id,
      name: e.name,
      color: e.color,
      points,
      pos,
    });
    return acc;
  }, []);

  actualRows.sort((a, b) => a.pos - b.pos);

  return {
    isProjected: false,
    rows: actualRows.map((e) => ({
      id: e.id,
      name: e.name,
      color: e.color,
      minPos: e.pos,
      maxPos: e.pos,
      minPoints: e.points,
      maxPoints: e.points,
    })),
  };
}

// Custom tooltip
function ChartTooltip({
  active,
  payload,
  label,
  races,
  afterRaceNum,
  projections,
  entities,
}: any) {
  if (!active || !payload?.length) return null;
  const raceNum = payload[0]?.payload?.raceNum;
  const race = races[raceNum - 1];

  const { rows, isProjected } = getStandingsRowsForRace({
    entities,
    projections,
    afterRaceNum,
    raceNum,
  });

  if (!rows.length) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-3 text-xs shadow-xl max-w-xs">
      <div className="font-semibold text-zinc-200 mb-2">
        {race?.fullLabel ?? label}
        {isProjected && <span className="ml-2 text-zinc-500">(projected)</span>}
      </div>
      <div className="space-y-0.5">
        <StandingsRows rows={rows} />
      </div>
    </div>
  );
}

function buildChartData(
  races: TimelineRace[],
  entities: EntitySeries[],
  afterRaceNum: number,
  isDriverMode: boolean
) {
  const startPt: Record<string, number | null | string> = {
    raceNum: 0,
    label: "Start",
  };
  for (const e of entities) {
    startPt[e.id] = 0;
    if (afterRaceNum === 0) {
      startPt[`${e.id}_floor`] = 0;
      startPt[`${e.id}_delta`] = 0;
    }
  }

  const racePts = races.map((race, i) => {
    const raceNum = i + 1;
    const pt: Record<string, number | null | string> = {
      raceNum,
      label: race.label,
    };

    for (const e of entities) {
      // Actual line: past races only
      pt[e.id] = raceNum <= afterRaceNum ? (e.cumulativePoints[i] ?? null) : null;

      // Cone: from the selected race forward
      if (raceNum >= afterRaceNum) {
        const base = e.cumulativePoints[afterRaceNum - 1] ?? 0;
        const additionalMax = races
          .slice(afterRaceNum, raceNum)
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

  return [startPt, ...racePts];
}

export function SeasonChart({ data }: { data: CalculatedChartData }) {
  const {
    races,
    lastCompletedRaceNum,
    drivers,
    constructors,
    driverProjections,
    constructorProjections,
    driverLockInsights,
    constructorLockInsights,
  } = data;
  const afterRaceParser = useMemo(
    () =>
      createParser({
        parse: (value) => {
          const num = parseInt(value);
          if (!num || num < 1) return null;
          return Math.min(num, lastCompletedRaceNum);
        },
        serialize: (value) => String(value),
      }).withDefault(lastCompletedRaceNum),
    [lastCompletedRaceNum]
  );
  const nextRaceOnlyParser = useMemo(
    () =>
      createParser({
        parse: (value) => {
          if (value === "true") return true;
          if (value === "false") return false;
          return null;
        },
        serialize: (value) => String(value),
      }).withDefault(true),
    []
  );
  const [afterRaceNum, setAfterRaceNum] = useQueryState("afterRace", afterRaceParser);
  const [nextRaceOnly, setNextRaceOnly] = useQueryState("nextRaceOnly", nextRaceOnlyParser);
  const [mode, setMode] = useState<"drivers" | "constructors">("drivers");
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const isDriverMode = mode === "drivers";
  const allEntities = isDriverMode ? drivers : constructors;
  const entities = allEntities.filter((e) => !hiddenIds.has(e.id));
  const projections: ProjectionMap = isDriverMode ? driverProjections : constructorProjections;
  const lockInsightsByRaceNum = isDriverMode ? driverLockInsights : constructorLockInsights;

  const chartData = useMemo(
    () => buildChartData(races, entities, afterRaceNum, isDriverMode),
    [races, entities, afterRaceNum, isDriverMode]
  );

  const currentRace = races[afterRaceNum - 1];
  const hasFuture = afterRaceNum < races.length;
  const lastRaceNum = races.length;

  function toggleEntity(id: string) {
    setHiddenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // Tick formatter: index 0 is the "Start" point; races start at index 1
  function xTickFormatter(label: string, index: number) {
    if (index === 0) return label;
    const race = races[index - 1];
    if (!race) return label;
    return race.type === "sprint" ? "·" : label;
  }

  const lastRace = races[lastRaceNum - 1];
  const entitiesById = useMemo(() => {
    const map = new Map<string, EntitySeries>();
    for (const entity of allEntities) {
      map.set(entity.id, entity);
    }
    return map;
  }, [allEntities]);

  const insightItems = useMemo(() => {
    const items = lockInsightsByRaceNum[String(afterRaceNum)] ?? [];
    if (!nextRaceOnly) return items;

    return items.filter(
      (insight) =>
        insight.type !== "can_be_locked_in_later" &&
        insight.type !== "can_be_ruled_out_later"
    );
  }, [lockInsightsByRaceNum, nextRaceOnly, afterRaceNum]);

  const { rows: lastRaceLegendRows, isProjected: isLastRaceProjected } = useMemo(
    () =>
      getStandingsRowsForRace({
        entities: allEntities,
        projections,
        afterRaceNum,
        raceNum: lastRaceNum,
      }),
    [allEntities, projections, afterRaceNum, lastRaceNum]
  );

  return (
    <div className="space-y-4">
      {/* Mode toggle + race info */}
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
          <span className="text-zinc-200 font-medium">{currentRace?.fullLabel}</span>
          {hasFuture && (
            <span className="ml-2 text-zinc-600">
              · {races.length - afterRaceNum} event
              {races.length - afterRaceNum !== 1 ? "s" : ""} remaining
            </span>
          )}
        </div>
      </div>

      {/* Time-travel scrubber */}
      <div className="space-y-1">
        <input
          type="range"
          min={1}
          max={lastCompletedRaceNum}
          value={afterRaceNum}
          onChange={(e) => setAfterRaceNum(Number(e.target.value))}
          className="w-full accent-red-500 cursor-pointer"
        />
        <div className="flex justify-between text-xs text-zinc-600">
          <span>{races[0]?.fullLabel}</span>
          <span>{races[lastCompletedRaceNum - 1]?.fullLabel}</span>
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
                    races={races}
                    afterRaceNum={afterRaceNum}
                    projections={projections}
                    entities={entities}
                  />
                }
                isAnimationActive={false}
              />

              {/* Future zone shading */}
              {hasFuture && (
                <ReferenceLine
                  x={currentRace?.label}
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
                    const race = races[props.index];
                    if (!race || props.value == null) return <g key={props.index} />;
                    // Different dot shape for sprint vs race
                    return race.type === "sprint" ? (
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
              Legend
              {lastRace && (
                <span className="ml-1 font-normal text-zinc-600">
                  · {isLastRaceProjected ? "Projected " : ""}
                  {lastRace.fullLabel}
                </span>
              )}
            </div>
            <div className="space-y-1">
              <StandingsRows
                rows={lastRaceLegendRows}
                getInteraction={(row) => ({
                  hidden: hiddenIds.has(row.id),
                  onClick: () => toggleEntity(row.id),
                })}
              />
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

      <div className="border-t border-zinc-800 pt-4">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div className="text-sm font-semibold text-zinc-300">Lock-in insights</div>
          <label className="flex items-center gap-2 text-xs text-zinc-400">
            <input
              type="checkbox"
              checked={nextRaceOnly}
              onChange={(e) => setNextRaceOnly(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-red-500"
            />
            Only show next-race lock-in scenarios
          </label>
        </div>
        <div key={mode} className="space-y-1 text-xs text-zinc-400 max-h-64 overflow-y-auto pr-2">
          {insightItems.map((insight, i) => <p key={i}>• {renderInsightText(insight, races, entitiesById)}</p>)}
        </div>
      </div>
    </div>
  );
}
