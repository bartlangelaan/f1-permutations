import type { LockInsight, TimelineRace } from "./calculate.ts";

export function renderInsightText(
  insight: LockInsight,
  races: TimelineRace[],
  entitiesById: Map<string, { name: string }>,
): string {
  const entityName = entitiesById.get(insight.entityId)?.name ?? insight.entityId;
  const positionLabel = `P${insight.position}`;
  const formatOutscoreCap = (opponentId: string, points: number) => {
    const opponentName = entitiesById.get(opponentId)?.name ?? opponentId;
    return points === 0
      ? `${entityName} does not outscore ${opponentName}`
      : `${entityName} does not outscore ${opponentName} by more than ${points} points`;
  };

  if (insight.type === "already_locked_in") {
    return `${entityName} has already locked in ${positionLabel}.`;
  }

  if (insight.type === "can_be_locked_in_later") {
    const race = races[insight.earliestRaceNum - 1];
    return `${entityName} can first guarantee at least ${positionLabel} after ${race?.fullLabel ?? `race ${insight.earliestRaceNum}`}.`;
  }

  if (insight.type === "can_be_ruled_out_later") {
    const race = races[insight.earliestRaceNum - 1];
    return `${entityName} could first lose the ability to finish ${positionLabel} after ${race?.fullLabel ?? `race ${insight.earliestRaceNum}`}.`;
  }

  const race = races[insight.nextRaceNum - 1];
  const details: string[] = [];

  if (insight.type === "can_be_locked_in_next_race_with_finish") {
    const race = races[insight.nextRaceNum - 1];
    return `${entityName} can guarantee at least ${positionLabel} in ${race?.fullLabel ?? "the next event"} by finishing P${insight.minFinishPos} or better.`;
  }

  if (insight.type === "can_be_locked_in_next_race") {
    if (insight.mustOutscoreBy.length) {
      details.push(
        `outscores ${insight.mustOutscoreBy
          .map(
            (c) => `${entitiesById.get(c.opponentId)?.name ?? c.opponentId} by ${c.points} points`,
          )
          .join(", ")}`,
      );
    }
    if (insight.cannotBeOutscoredByMoreThan.length) {
      details.push(
        `is not outscored by ${insight.cannotBeOutscoredByMoreThan
          .map(
            (c) =>
              `${entitiesById.get(c.opponentId)?.name ?? c.opponentId} by more than ${c.points} points`,
          )
          .join(", ")}`,
      );
    }
    const detailText = details.length
      ? ` if ${details.join(" and ")}`
      : " regardless of the result there";
    return `${entityName} can guarantee at least ${positionLabel} in ${race?.fullLabel ?? "the next event"}${detailText}.`;
  }

  if (insight.mustBeOutscoredBy.length) {
    details.push(
      `is outscored by ${insight.mustBeOutscoredBy
        .map((c) => `${entitiesById.get(c.opponentId)?.name ?? c.opponentId} by ${c.points} points`)
        .join(", ")}`,
    );
  }
  if (insight.cannotOutscoreByMoreThan.length) {
    details.push(
      `${insight.cannotOutscoreByMoreThan
        .map((c) => formatOutscoreCap(c.opponentId, c.points))
        .join(", ")}`,
    );
  }
  const detailText = details.length ? ` if ${details.join(" and ")}` : "";
  return `${positionLabel} is no longer possible for ${entityName} in ${race?.fullLabel ?? "the next event"}${detailText}.`;
}
