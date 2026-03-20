import React from "react";
import { partyColorMap } from "../data/partiesPalette.js";

export default function SeatPanel({ seat, displayMode = "vote" }) {
  if (!seat) {
    return (
      <aside className="panel panel--member">
        <div className="panel-empty">
          <h2>No member selected</h2>
          <p>Click a seat in the chamber.</p>
        </div>
      </aside>
    );
  }

  const name =
    seat.member?.Deputy || seat.assignment?.deputy_name || "Unassigned seat";
  const imageUrl = seat.member?.imageUrl || "";
  const party = seat.member?.Party || "";
  const constituency = seat.member?.Constituency || "";
  const memberId = seat.member?.Code || seat.assignment?.member_code || "";
  const memberUrl = memberId
    ? `https://www.oireachtas.ie/en/members/member/${memberId}/`
    : "";

  const borderColor = partyColorMap[party] || "#d6d3d1";
  const voteLabel = seat.vote?.vote || "";

  const cardInner = (
    <div className="member-card">
      <div className="member-card__identity-block">
        {imageUrl ? (
          <div className="member-photo-ring" style={{ borderColor }}>
            <img
              src={imageUrl}
              alt={name}
              className="member-photo member-photo--round"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          </div>
        ) : (
          <div
            className="member-photo-ring member-photo-ring--empty"
            style={{ borderColor }}
          >
            <div className="member-photo-placeholder">TD</div>
          </div>
        )}

        <div className="member-card__identity">
          <h2>{name}</h2>
        </div>
      </div>

      {displayMode === "vote" ? (
        <div
          className={`vote-banner vote-banner--${seat.vote?.vote || "Absent"}`}
        >
          {voteLabel}
        </div>
      ) : null}

      <div className="member-meta member-meta--inline">
        <div className="member-meta__item">
          <span className="member-meta__label">Party</span>
          <span className="member-meta__value">{party || "—"}</span>
        </div>

        <div className="member-meta__item">
          <span className="member-meta__label">Constituency</span>
          <span className="member-meta__value">{constituency || "—"}</span>
        </div>
      </div>
    </div>
  );

  return (
    <aside className="panel panel--member panel--member-active">
      {memberUrl ? (
        <a
          href={memberUrl}
          target="_blank"
          rel="noreferrer"
          className="member-card-link"
          aria-label={`Open profile for ${name}`}
        >
          {cardInner}
        </a>
      ) : (
        cardInner
      )}
    </aside>
  );
}
