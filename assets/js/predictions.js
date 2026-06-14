import {
  clearElement,
  createElement,
  setHidden,
  setStatus,
} from "./dom.js";

const PREDICTIONS_LIMIT = 12;

export async function loadPredictions(config, elements) {
  if (!config.predictionsJsonUrl) {
    showPredictionsEmpty(elements);
    return;
  }

  try {
    const response = await fetch(config.predictionsJsonUrl, { cache: "no-store" });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const records = normalizePredictions(await response.json());
    renderPredictions(records, elements);
  } catch (error) {
    showPredictionsError(`Could not load latest picks: ${error.message}`, elements);
  }
}

export function normalizePredictions(value) {
  if (!Array.isArray(value)) {
    throw new Error("predictions.json must contain an array");
  }

  return value
    .map((row) => ({
      displayName: cleanText(row.display_name),
      homeTeam: cleanText(row.home_team),
      awayTeam: cleanText(row.away_team),
      prediction: cleanText(row.prediction),
      matchId: cleanText(row.match_id),
      matchNumber: Number.parseInt(row.match_number, 10),
      stage: cleanText(row.stage),
      group: cleanText(row.group),
      updatedAt: cleanText(row.updated_at),
    }))
    .filter((record) => record.displayName && record.homeTeam && record.awayTeam && record.prediction)
    .sort(comparePredictions);
}

function renderPredictions(records, elements) {
  if (records.length === 0) {
    showPredictionsEmpty(elements);
    return;
  }

  clearElement(elements.predictionsList);

  for (const group of groupByMatch(records).slice(0, PREDICTIONS_LIMIT)) {
    elements.predictionsList.appendChild(createPredictionCard(group));
  }

  setHidden(elements.predictionsStatus, true);
  setHidden(elements.predictionsList, false);
  setHidden(elements.predictionsEmpty, true);
}

function createPredictionCard(group) {
  const card = createElement("article", { className: "prediction-card" });

  const header = createElement("div", { className: "prediction-head" });
  header.append(
    createElement("span", { className: "prediction-stage", text: matchContext(group) }),
    createElement("span", { className: "prediction-updated", text: latestUpdatedText(group.records) })
  );

  const fixture = createElement("h3", { className: "prediction-fixture" });
  fixture.append(
    createElement("span", { text: group.homeTeam }),
    createElement("span", { className: "prediction-vs", text: "vs" }),
    createElement("span", { text: group.awayTeam })
  );

  const picks = createElement("ul", { className: "prediction-picks" });
  for (const record of group.records) {
    const item = createElement("li", { className: "prediction-pick" });
    item.append(
      createElement("span", { className: "prediction-manager", text: record.displayName }),
      createElement("span", { className: "prediction-choice", text: predictionLabel(record) })
    );
    picks.appendChild(item);
  }

  card.append(header, fixture, picks);
  return card;
}

function groupByMatch(records) {
  const groups = new Map();
  for (const record of records) {
    const key = record.matchId || `${record.homeTeam}-${record.awayTeam}`;
    if (!groups.has(key)) {
      groups.set(key, {
        matchId: record.matchId,
        matchNumber: record.matchNumber,
        stage: record.stage,
        group: record.group,
        homeTeam: record.homeTeam,
        awayTeam: record.awayTeam,
        records: [],
      });
    }
    groups.get(key).records.push(record);
  }

  return Array.from(groups.values()).map((group) => ({
    ...group,
    records: group.records.sort(comparePredictionRows),
  }));
}

function predictionLabel(record) {
  if (record.prediction === "home") return `${record.homeTeam} wins`;
  if (record.prediction === "away") return `${record.awayTeam} wins`;
  if (record.prediction === "draw") return "Draw";
  return record.prediction;
}

function matchContext(group) {
  const parts = [];
  if (Number.isFinite(group.matchNumber)) {
    parts.push(`Match ${group.matchNumber}`);
  }
  if (group.stage) {
    parts.push(group.stage);
  }
  if (group.group) {
    parts.push(`Group ${group.group}`);
  }
  return parts.join(" · ") || "Match";
}

function latestUpdatedText(records) {
  const latest = records
    .map((record) => record.updatedAt)
    .filter(Boolean)
    .sort()
    .at(-1);

  if (!latest) {
    return "";
  }

  const date = new Date(latest);
  if (Number.isNaN(date.getTime())) {
    return latest;
  }
  return `Updated ${date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`;
}

function comparePredictions(a, b) {
  return compareUpdatedDesc(a, b) || compareMatchNumber(a, b) || comparePredictionRows(a, b);
}

function comparePredictionRows(a, b) {
  return a.displayName.localeCompare(b.displayName);
}

function compareUpdatedDesc(a, b) {
  return (b.updatedAt || "").localeCompare(a.updatedAt || "");
}

function compareMatchNumber(a, b) {
  if (Number.isFinite(a.matchNumber) && Number.isFinite(b.matchNumber)) {
    return a.matchNumber - b.matchNumber;
  }
  return 0;
}

function cleanText(value) {
  return value === undefined || value === null ? "" : String(value).trim();
}

function showPredictionsError(message, elements) {
  setStatus(elements.predictionsStatus, message, true);
  setHidden(elements.predictionsList, true);
  setHidden(elements.predictionsEmpty, true);
}

function showPredictionsEmpty(elements) {
  setHidden(elements.predictionsStatus, true);
  setHidden(elements.predictionsList, true);
  setHidden(elements.predictionsEmpty, false);
}
