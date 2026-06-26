import React from "react";
import { partyColorMap } from "../data/partiesPalette.js";

export default function SeatPanel({ seat, chamber }) {
  if (!seat) {
    return (
      <aside className="panel panel--member">
        <div className="panel-empty">
          <h2>{chamber.emptySelectionTitle}</h2>
          <p>{chamber.emptySelectionPrompt}</p>
        </div>
      </aside>
    );
  }

  const name =
    seat.member?.Deputy || seat.assignment?.deputy_name || "Unassigned seat";
  const imageUrl = seat.member?.imageUrl || "";
  const party = seat.member?.Party || "";
  const memberId = seat.member?.Code || seat.assignment?.member_code || "";
  const memberUrl = memberId
    ? `https://www.oireachtas.ie/en/members/member/${memberId}/`
    : "";

  const secondaryValue = chamber.getSecondaryValue(seat);
  const tertiaryValue = chamber.getTertiaryValue(seat);
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
            <div className="member-photo-placeholder">
              {chamber.placeholderInitial}
            </div>
          </div>
        )}

        <div className="member-card__identity">
          <h2>{name}</h2>
        </div>
      </div>

      <div className={`vote-banner vote-banner--${seat.vote?.vote || "Absent"}`}>
        {voteLabel}
      </div>

      <div className="member-meta member-meta--inline">
        {tertiaryValue ? (
          <div className="member-meta__item">
            <span className="member-meta__label">{chamber.tertiaryLabel}</span>
            <span className="member-meta__value">{tertiaryValue}</span>
          </div>
        ) : null}

        <div className="member-meta__item">
          <span className="member-meta__label">Party</span>
          <span className="member-meta__value">{party || "—"}</span>
        </div>

        <div className="member-meta__item">
          <span className="member-meta__label">{chamber.secondaryLabel}</span>
          <span className="member-meta__value">{secondaryValue || "—"}</span>
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
