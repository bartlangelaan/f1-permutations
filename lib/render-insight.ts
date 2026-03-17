import type { LockInsight, TimelineRace } from "./calculate.ts";

export function renderInsightTexts(
  insight: LockInsight,
  races: TimelineRace[],
  entitiesById: Map<string, { name: string }>,
): string[] {
  const entityName = entitiesById.get(insight.entityId)?.name ?? insight.entityId;
  const positionLabel = `P${insight.position}`;
  const formatOutscoreCap = (opponentId: string, points: number) => {
    const opponentName = entitiesById.get(opponentId)?.name ?? opponentId;
    return points === 0
      ? `${entityName} does not outscore ${opponentName}`
      : `${entityName} does not outscore ${opponentName} by more than ${points} points`;
  };

  if (insight.type === "already_locked_in") {
    return [`${entityName} has already locked in ${positionLabel}.`];
  }

  if (insight.type === "can_be_locked_in_later") {
    const race = races[insight.earliestRaceNum - 1];
    return [
      `${entityName} can first guarantee at least ${positionLabel} after ${race?.fullLabel ?? `race ${insight.earliestRaceNum}`}.`,
    ];
  }

  if (insight.type === "can_be_ruled_out_later") {
    const race = races[insight.earliestRaceNum - 1];
    return [
      `${entityName} could first lose the ability to finish ${positionLabel} after ${race?.fullLabel ?? `race ${insight.earliestRaceNum}`}.`,
    ];
  }

  const race = races[insight.nextRaceNum - 1];
  const raceLabel = race?.fullLabel ?? "the next event";
  const details: string[] = [];

  if (insight.type === "can_be_locked_in_next_race") {
    const sentences: string[] = [];

    // Points-margin sentence (present when mustOutscoreBy or cannotBeOutscoredByMoreThan is non-empty).
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
    if (details.length > 0 || !insight.racePositionCombinations) {
      const detailText = details.length
        ? ` if ${details.join(" and ")}`
        : " regardless of the result there";
      sentences.push(
        `${entityName} can guarantee at least ${positionLabel} in ${raceLabel}${detailText}.`,
      );
    }

    // Position-combination sentences: one per entry in the table.
    if (insight.racePositionCombinations) {
      for (const combo of insight.racePositionCombinations) {
        const byLine =
          combo.raceFinishPos === null
            ? "regardless of finishing position"
            : `by finishing P${combo.raceFinishPos} or better`;
        if (combo.rivalConstraints.length === 0) {
          const suffix = combo.raceFinishPos === null ? "" : " regardless of rivals";
          sentences.push(
            `${entityName} can guarantee ${positionLabel} in ${raceLabel} ${byLine}${suffix}.`,
          );
        } else {
          const rivalText = combo.rivalConstraints
            .map(
              (r) =>
                `${entitiesById.get(r.opponentId)?.name ?? r.opponentId} finishes P${r.maxRaceFinishPos} or worse`,
            )
            .join(" and ");
          sentences.push(
            `${entityName} can guarantee ${positionLabel} in ${raceLabel} ${byLine} if ${rivalText}.`,
          );
        }
      }
    }

    return sentences;
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
  return [`${positionLabel} is no longer possible for ${entityName} in ${raceLabel}${detailText}.`];
}
