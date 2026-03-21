import fs from "fs/promises";

const OUTPUT_PATH = "public/data/voteDetails.json";

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function extractSectionNumber(section) {
  if (!section) return "";
  return String(section).replace("dbsect_", "");
}

function buildDebateUrl(date, section) {
  const sectionNumber = extractSectionNumber(section);
  if (!date || !sectionNumber) return null;
  return `https://www.oireachtas.ie/en/debates/debate/dail/${date}/${sectionNumber}/`;
}

async function fetchVotes() {
  const dateStart = "2026-01-01";
  const dateEnd = todayISO();

  const url = `https://api.oireachtas.ie/v1/divisions?date_start=${dateStart}&date_end=${dateEnd}&limit=500`;

  console.log(`→ Fetching: ${url}`);

  const res = await fetch(url);
  const json = await res.json();

  if (!json?.results) {
    throw new Error("No results returned from API");
  }

  return json.results;
}

function transform(results) {
  return results
    .map((d) => {
      const division = d?.division;

      return {
        id: division?.voteId,

        tallies: division?.tallies,
        house: division?.chamber?.showAs,
        outcome: division?.outcome,

        debateShowAs: division?.debate?.showAs,
        subject: division?.subject?.showAs,
        tellers: division?.tellers,

        voteID: division?.voteId,
        date: d?.contextDate,
        section: division?.debate?.debateSection,

        debateUrl: buildDebateUrl(
          d?.contextDate,
          division?.debate?.debateSection,
        ),
      };
    })
    .filter((d) => d.house === "Dáil Éireann");
}

async function main() {
  try {
    const raw = await fetchVotes();
    const processed = transform(raw);

    await fs.mkdir("public/data", { recursive: true });
    await fs.writeFile(
      OUTPUT_PATH,
      JSON.stringify(processed, null, 2),
      "utf-8",
    );

    console.log(`✓ Wrote ${processed.length} votes → ${OUTPUT_PATH}`);
  } catch (err) {
    console.error("✗ Failed:", err);
    process.exit(1);
  }
}

main();
