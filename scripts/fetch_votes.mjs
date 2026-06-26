import fs from "fs/promises";

const API_URL = "https://api.oireachtas.ie/v1/divisions";
const DATE_START = "2025-11-25";
const LOOKBACK_DAYS = 14;
const MAX_RETRIES = 4;
const REQUEST_TIMEOUT_MS = 30_000;
const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);
const FETCH_LIMIT = 500;

const CHAMBERS = [
  {
    key: "dail",
    house: "Dáil Éireann",
    debatePath: "dail",
    outputPath: "public/chambers/dail/data/voteDetails.json",
  },
  {
    key: "seanad",
    house: "Seanad Éireann",
    debatePath: "seanad",
    outputPath: "public/chambers/seanad/data/voteDetails.json",
  },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(attempt) {
  const baseDelay = 1_000 * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 500);
  return baseDelay + jitter;
}

function previewBody(bodyText) {
  return bodyText.replace(/\s+/g, " ").trim().slice(0, 200);
}

function isRetryableResponse(status, contentType) {
  if (RETRYABLE_STATUS_CODES.has(status)) return true;
  return Boolean(contentType && !contentType.includes("application/json"));
}

function extractSectionNumber(section) {
  if (!section) return "";
  return String(section).replace("dbsect_", "");
}

function buildDebateUrl(debatePath, date, section) {
  const sectionNumber = extractSectionNumber(section);
  if (!date || !sectionNumber) return null;
  return `https://www.oireachtas.ie/en/debates/debate/${debatePath}/${date}/${sectionNumber}/`;
}

function shiftIsoDate(isoDate, days) {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getVoteOrderNumber(vote) {
  const raw = vote?.voteID || vote?.id || "";
  const match = String(raw).match(/(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function buildStableVoteId(record) {
  return [record?.date, record?.section, record?.voteID, record?.debateShowAs]
    .filter(Boolean)
    .join("::");
}

async function readExistingVotes(filePath) {
  try {
    const raw = await fs.readFile(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

function getLatestVoteDate(records) {
  return records
    .map((record) => record?.date || "")
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

async function getFetchStartDate() {
  const latestDates = [];

  for (const chamber of CHAMBERS) {
    const existingVotes = await readExistingVotes(chamber.outputPath);
    const latestDate = getLatestVoteDate(existingVotes);

    if (latestDate) {
      latestDates.push(shiftIsoDate(latestDate, -LOOKBACK_DAYS));
    }
  }

  if (latestDates.length === 0) {
    return DATE_START;
  }

  return latestDates.sort()[0];
}

function buildVotesUrl(dateStart) {
  const dateEnd = todayISO();
  return `${API_URL}?date_start=${dateStart}&date_end=${dateEnd}&limit=${FETCH_LIMIT}`;
}

async function fetchVotes(dateStart) {
  const url = buildVotesUrl(dateStart);
  let lastError;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    console.log(`→ Fetching (${attempt}/${MAX_RETRIES}): ${url}`);

    try {
      const res = await fetch(url, {
        headers: {
          Accept: "application/json",
          "User-Agent": "chamber-vote-poc/0.0.0 (GitHub Actions vote fetch)",
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });

      const contentType = res.headers.get("content-type") || "";
      const bodyText = await res.text();

      if (!res.ok) {
        const message =
          `HTTP ${res.status} ${res.statusText}; ` +
          `content-type=${contentType || "unknown"}; ` +
          `body="${previewBody(bodyText)}"`;
        const error = new Error(message);

        if (attempt < MAX_RETRIES && isRetryableResponse(res.status, contentType)) {
          const retryDelayMs = getRetryDelayMs(attempt);
          console.warn(`↻ Retryable response, waiting ${retryDelayMs}ms: ${message}`);
          await sleep(retryDelayMs);
          continue;
        }

        throw error;
      }

      if (!contentType.includes("application/json")) {
        const message =
          `Expected JSON but received content-type=${contentType || "unknown"}; ` +
          `body="${previewBody(bodyText)}"`;

        if (attempt < MAX_RETRIES) {
          const retryDelayMs = getRetryDelayMs(attempt);
          console.warn(`↻ Non-JSON response, waiting ${retryDelayMs}ms: ${message}`);
          await sleep(retryDelayMs);
          continue;
        }

        throw new Error(message);
      }

      let json;
      try {
        json = JSON.parse(bodyText);
      } catch (error) {
        throw new Error(
          `Invalid JSON response; content-type=${contentType}; body="${previewBody(bodyText)}"; cause=${error.message}`,
        );
      }

      if (!json?.results) {
        throw new Error("No results returned from API");
      }

      if (json.results.length >= FETCH_LIMIT) {
        console.warn(
          `⚠ Received ${json.results.length} results, which matches the request limit of ${FETCH_LIMIT}.`,
        );
      }

      return json.results;
    } catch (error) {
      lastError = error;

      if (attempt >= MAX_RETRIES) {
        break;
      }

      const retryDelayMs = getRetryDelayMs(attempt);
      console.warn(`↻ Fetch attempt failed, waiting ${retryDelayMs}ms: ${error.message}`);
      await sleep(retryDelayMs);
    }
  }

  throw lastError;
}

function transform(results, chamber) {
  return results
    .map((result) => {
      const division = result?.division;

      return {
        id: division?.voteId,
        tallies: division?.tallies,
        house: division?.chamber?.showAs,
        outcome: division?.outcome,
        debateShowAs: division?.debate?.showAs,
        subject: division?.subject?.showAs,
        tellers: division?.tellers,
        voteID: division?.voteId,
        date: result?.contextDate,
        section: division?.debate?.debateSection,
        debateUrl: buildDebateUrl(
          chamber.debatePath,
          result?.contextDate,
          division?.debate?.debateSection,
        ),
      };
    })
    .filter((record) => record.house === chamber.house);
}

function mergeVotes(existingVotes, recentVotes) {
  const merged = new Map();

  for (const record of existingVotes) {
    merged.set(buildStableVoteId(record), record);
  }

  for (const record of recentVotes) {
    merged.set(buildStableVoteId(record), record);
  }

  return Array.from(merged.values()).sort((a, b) => {
    const dateDiff = String(b.date || "").localeCompare(String(a.date || ""));
    if (dateDiff !== 0) return dateDiff;

    const voteDiff = getVoteOrderNumber(b) - getVoteOrderNumber(a);
    if (voteDiff !== 0) return voteDiff;

    return String(b.id || "").localeCompare(String(a.id || ""));
  });
}

async function writeVotes(filePath, records) {
  const parent = filePath.split("/").slice(0, -1).join("/");
  await fs.mkdir(parent, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(records, null, 2), "utf-8");
}

async function main() {
  try {
    const fetchStart = await getFetchStartDate();
    const raw = await fetchVotes(fetchStart);

    for (const chamber of CHAMBERS) {
      const existingVotes = await readExistingVotes(chamber.outputPath);
      const latestVotes = transform(raw, chamber);
      const mergedVotes = mergeVotes(existingVotes, latestVotes);

      await writeVotes(chamber.outputPath, mergedVotes);

      console.log(
        `✓ Wrote ${mergedVotes.length} ${chamber.key} votes → ${chamber.outputPath}`,
      );
    }
  } catch (error) {
    console.error("✗ Failed:", error);
    process.exit(1);
  }
}

main();
