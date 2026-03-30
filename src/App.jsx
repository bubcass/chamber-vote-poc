import React, { useEffect, useMemo, useState } from "react";
import { loadCsv } from "./lib/csv.js";
import { byKey, normaliseMemberApiRows, clean } from "./lib/joins.js";
import ChamberMap from "./components/ChamberMap.jsx";
import SeatPanel from "./components/SeatPanel.jsx";
import membersJson from "./data/members.json";
import { normaliseVotesDataset } from "./lib/votes.js";
import "./styles.css";

function formatIrishDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  return new Intl.DateTimeFormat("en-IE", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

function makeVoteOptionLabel(vote) {
  const date = formatIrishDate(vote.date);
  const title = vote.debateShowAs || "Division";
  return date ? `${date} | ${title}` : title;
}

function extractSectionNumber(section) {
  if (!section) return "";
  const match = String(section).match(/(\d+)$/);
  return match ? match[1] : "";
}

function buildDebateUrl(date, section) {
  const sectionNumber = extractSectionNumber(section);
  if (!date || !sectionNumber) return null;
  return `https://www.oireachtas.ie/en/debates/debate/dail/${date}/${sectionNumber}/`;
}

function getVoteOrderNumber(vote) {
  const raw = vote.voteID || vote.id || "";
  const match = String(raw).match(/(\d+)$/);
  return match ? Number(match[1]) : -1;
}

function csvEscape(value) {
  const str = String(value ?? "");
  if (str.includes('"') || str.includes(",") || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function buildVoteCsv(rows) {
  const headers = [
    "name",
    "party",
    "constituency",
    "vote_subject",
    "vote_result",
    "vote_cast",
    "date",
  ];

  const lines = [
    headers.join(","),
    ...rows.map((row) =>
      headers.map((header) => csvEscape(row[header])).join(","),
    ),
  ];

  return lines.join("\n");
}

function downloadTextFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function useIframeResize() {
  useEffect(() => {
    function sendHeight() {
      const height =
        Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        ) + 8;

      window.parent.postMessage(
        {
          type: "vote-explorer:resize",
          height,
        },
        "*",
      );
    }

    const timeoutId = setTimeout(sendHeight, 100);

    const resizeObserver = new ResizeObserver(() => {
      sendHeight();
    });

    if (document.body) {
      resizeObserver.observe(document.body);
    }

    window.addEventListener("load", sendHeight);
    window.addEventListener("resize", sendHeight);

    return () => {
      clearTimeout(timeoutId);
      resizeObserver.disconnect();
      window.removeEventListener("load", sendHeight);
      window.removeEventListener("resize", sendHeight);
    };
  }, []);
}

export default function App() {
  useIframeResize();

  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [votes, setVotes] = useState([]);
  const [selectedVoteId, setSelectedVoteId] = useState("");
  const [selectedSeat, setSelectedSeat] = useState(null);
  const [query, setQuery] = useState("");
  const [voteFilter, setVoteFilter] = useState(null);
  const [votesLoading, setVotesLoading] = useState(true);
  const [votesError, setVotesError] = useState("");

  useEffect(() => {
    async function init() {
      const seatingRowsRaw = await loadCsv(
        `${import.meta.env.BASE_URL}seatAssignments.csv`,
      );

      const seatingRows = seatingRowsRaw.map((row) => ({
        ...row,
        seat_label: clean(row.seat_label),
        deputy_name: clean(row.deputy_name ?? row.Deputy),
        member_code: clean(row.member_code ?? row.memberCode),
        path_id: clean(row.path_id),
      }));

      setAssignments(seatingRows);
      setMembers(normaliseMemberApiRows(membersJson));
    }

    init();
  }, []);

  useEffect(() => {
    async function loadVotes() {
      setVotesLoading(true);
      setVotesError("");

      try {
        const res = await fetch(
          `${import.meta.env.BASE_URL}data/voteDetails.json`,
          {
            cache: "no-store",
          },
        );

        if (!res.ok) {
          throw new Error(`Failed to fetch vote data (${res.status})`);
        }

        const json = await res.json();
        const normalised = normaliseVotesDataset(json).sort(
          (a, b) => getVoteOrderNumber(b) - getVoteOrderNumber(a),
        );

        setVotes(normalised);
        setSelectedVoteId(normalised[0]?.id || "");
      } catch (err) {
        console.error(err);
        setVotesError("Unable to load vote data.");
      } finally {
        setVotesLoading(false);
      }
    }

    loadVotes();
  }, []);

  const selectedVote = useMemo(() => {
    const vote = votes.find((v) => v.id === selectedVoteId) || null;
    if (!vote) return null;

    return {
      ...vote,
      debateUrl: buildDebateUrl(vote.date, vote.section),
    };
  }, [votes, selectedVoteId]);

  const voteSummaryItems = useMemo(() => {
    if (!selectedVote) return [];

    const tallyYes = selectedVote.tallies?.["Tá"] ?? 0;
    const tallyNo = selectedVote.tallies?.["Níl"] ?? 0;
    const tallyAbstain = selectedVote.tallies?.["Staon"] ?? 0;

    return [
      {
        key: "Tá",
        label: "Tá",
        count: tallyYes,
        active: voteFilter === "Tá",
        className: "vote-summary__item--yes",
        value: "Tá",
        showCount: true,
      },
      {
        key: "Níl",
        label: "Níl",
        count: tallyNo,
        active: voteFilter === "Níl",
        className: "vote-summary__item--no",
        value: "Níl",
        showCount: true,
      },
      {
        key: "Staon",
        label: "Staon",
        count: tallyAbstain,
        active: voteFilter === "Staon",
        className: "vote-summary__item--abstain",
        value: "Staon",
        showCount: true,
      },
      {
        key: "Clear",
        label: "Clear filter",
        count: null,
        active: voteFilter === null,
        className: "vote-summary__item--all",
        value: null,
        showCount: false,
      },
    ];
  }, [selectedVote, voteFilter]);

  const assignmentsBySeat = useMemo(
    () => byKey(assignments, "seat_label"),
    [assignments],
  );

  const membersByCode = useMemo(() => byKey(members, "Code"), [members]);

  const seats = useMemo(() => {
    const labels = Object.keys(assignmentsBySeat);

    return labels.map((seat_label) => {
      const assignment = assignmentsBySeat[seat_label] || null;

      let member = null;
      if (assignment?.member_code) {
        member = membersByCode[clean(assignment.member_code)] || null;
      }

      const vote =
        assignment?.member_code && selectedVote?.byMemberCode
          ? selectedVote.byMemberCode[clean(assignment.member_code)] || null
          : null;

      return {
        seat_label,
        assignment,
        member,
        vote,
      };
    });
  }, [assignmentsBySeat, membersByCode, selectedVote]);

  const filteredSeats = useMemo(() => {
    const q = query.toLowerCase();

    return seats.filter((seat) => {
      const haystack = [
        seat.seat_label,
        seat.member?.Deputy,
        seat.member?.Party,
        seat.member?.Constituency,
        seat.vote?.vote,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [seats, query]);

  const currentVoteDownloadRows = useMemo(() => {
    if (!selectedVote) return [];

    return seats
      .filter((seat) => seat.member)
      .map((seat) => ({
        name: seat.member?.Deputy || "",
        party: seat.member?.Party || "",
        constituency: seat.member?.Constituency || "",
        vote_subject: selectedVote?.subject || "",
        vote_result: selectedVote?.outcome || "",
        vote_cast: seat.vote?.vote || "",
        date: selectedVote?.date || "",
      }));
  }, [seats, selectedVote]);

  function handleDownloadCurrentVoteCsv() {
    if (!selectedVote || currentVoteDownloadRows.length === 0) return;

    const csv = buildVoteCsv(currentVoteDownloadRows);
    const safeId = (selectedVote.voteID || selectedVote.id || "vote").replace(
      /[^a-zA-Z0-9_-]/g,
      "",
    );

    downloadTextFile(`${safeId}.csv`, csv, "text/csv;charset=utf-8;");
  }

  const selected =
    seats.find((seat) => seat.seat_label === selectedSeat) || null;
  const hasSelection = Boolean(selected);

  return (
    <div className="app">
      <section className="hero">
        <div className="hero__media">
          <video
            className="hero__video"
            src={`${import.meta.env.BASE_URL}media/chamber-vote-hero.mp4`}
            autoPlay
            muted
            loop
            playsInline
          />
        </div>

        <div className="hero__overlay">
          <div className="hero__content">
            <p className="hero__eyebrow">Stór | Open data insights</p>
            <h1 className="hero__title">Vote Explorer</h1>
            <p className="hero__subtitle">
              Explore how TDs voted in Dáil Éireann with an interactive chamber
              map.
            </p>
          </div>
        </div>
      </section>

      <header className="hero-controls">
        <div className="controls controls--single">
          <select
            value={selectedVoteId}
            onChange={(e) => {
              setSelectedVoteId(e.target.value);
              setSelectedSeat(null);
              setVoteFilter(null);
            }}
            disabled={votesLoading || votes.length === 0}
          >
            {votesLoading ? (
              <option>Loading votes…</option>
            ) : votes.length === 0 ? (
              <option>No votes available</option>
            ) : (
              votes.map((vote) => (
                <option key={vote.id} value={vote.id}>
                  {makeVoteOptionLabel(vote)}
                </option>
              ))
            )}
          </select>
        </div>
      </header>

      <main className="layout layout--stacked">
        {votesError ? (
          <section className="panel">
            <p>{votesError}</p>
          </section>
        ) : null}

        <section className="main-panel main-panel--full">
          {selectedVote ? (
            <div className="vote-header">
              <div className="vote-debate-meta">
                <span className="vote-debate-meta__label">Debate</span>

                {selectedVote.debateUrl ? (
                  <a
                    href={selectedVote.debateUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="vote-debate-meta__link"
                  >
                    {selectedVote.debateShowAs || "—"}
                  </a>
                ) : (
                  <span className="vote-debate-meta__value">
                    {selectedVote.debateShowAs || "—"}
                  </span>
                )}
              </div>

              <div
                className={`vote-summary${
                  voteFilter ? " vote-summary--has-active" : ""
                }`}
              >
                {voteSummaryItems.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    className={`vote-summary__item ${item.className}${
                      item.active ? " vote-summary__item--active" : ""
                    }`}
                    onClick={() => {
                      setVoteFilter(item.value);
                      setSelectedSeat(null);
                    }}
                    aria-pressed={item.active}
                    title={
                      item.value === null
                        ? "Clear vote filter"
                        : item.active
                          ? `Showing ${item.label}`
                          : `Focus ${item.label}`
                    }
                  >
                    <span className="vote-summary__dot" />
                    {item.label}
                    {item.showCount ? ` ${item.count}` : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <ChamberMap
            seats={filteredSeats}
            allSeats={seats}
            selectedSeat={selectedSeat}
            onSelect={setSelectedSeat}
            displayMode="vote"
            voteFilter={voteFilter}
          />
        </section>

        <section className="panel panel--search">
          <div className="search-input-wrap">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by Deputy, constituency or party"
              aria-label="Filter by Deputy, constituency or party"
            />
            {query ? (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
                title="Clear search"
              >
                ×
              </button>
            ) : null}
          </div>
        </section>

        <section
          className={
            hasSelection ? "detail-grid" : "detail-grid detail-grid--single"
          }
        >
          {selectedVote ? (
            <section className="panel panel--detail">
              <div className="vote-context-card">
                <div className="vote-context-card__item">
                  <span className="vote-context-card__label">
                    Division called
                  </span>

                  {selectedVote.debateUrl ? (
                    <a
                      href={selectedVote.debateUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="vote-context-card__link"
                    >
                      {selectedVote.subject || "—"}
                    </a>
                  ) : (
                    <span className="vote-context-card__value">
                      {selectedVote.subject || "—"}
                    </span>
                  )}
                </div>

                <div className="vote-context-card__item">
                  <span className="vote-context-card__label">Outcome</span>
                  <span className="vote-context-card__value">
                    {selectedVote.outcome || "—"}
                  </span>
                </div>

                <div className="vote-context-card__item">
                  <span className="vote-context-card__label">Tellers</span>
                  <span className="vote-context-card__value">
                    {selectedVote.tellers || "—"}
                  </span>
                </div>

                <div className="vote-context-card__item">
                  <span className="vote-context-card__label">Date</span>
                  <span className="vote-context-card__value">
                    {formatIrishDate(selectedVote.date) || "—"}
                  </span>
                </div>
              </div>
            </section>
          ) : null}

          {hasSelection ? (
            <SeatPanel seat={selected} displayMode="vote" />
          ) : null}
        </section>

        <section className="download-block">
          <button
            type="button"
            className="pq-download"
            onClick={handleDownloadCurrentVoteCsv}
            disabled={!selectedVote}
          >
            Download this vote data
          </button>
        </section>
      </main>
    </div>
  );
}
