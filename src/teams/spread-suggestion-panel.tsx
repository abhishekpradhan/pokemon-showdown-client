import { useEffect, useState } from 'react';
import type { TeamSet } from '../compat/team-store';
import { genFromFormat } from '../data/dex';
import {
  applySpreadSuggestion,
  describeSpread,
  GUESSER_SOURCE,
  suggestSpread,
  type SpreadSuggestion,
} from './spread-suggestion';

export function SpreadSuggestionPanel({
  set,
  format,
  onChange,
}: {
  set: TeamSet;
  format: string;
  onChange: (set: TeamSet) => void;
}) {
  const [result, setResult] = useState<{ set: TeamSet; format: string; suggestion: SpreadSuggestion }>();
  const [applied, setApplied] = useState<{ before: TeamSet; after: string }>();
  useEffect(() => {
    let cancelled = false;
    void suggestSpread(set, format)
      .then(suggestion => {
        if (!cancelled) setResult({ set, format, suggestion });
      })
      .catch(() => {
        if (!cancelled)
          setResult({
            set,
            format,
            suggestion: {
              available: false,
              reason: 'The spread helper could not load. Manual EV editing remains available.',
            },
          });
      });
    return () => {
      cancelled = true;
    };
  }, [set, format]);
  const suggestion = result?.set === set && result.format === format ? result.suggestion : undefined;
  const canUndo = applied?.after === JSON.stringify(set);

  return (
    <section className="set-spread-suggestion" aria-label="Inferred EV spread">
      <div className="set-suggestion-heading">
        <strong>Suggested spread</strong>
        <a href={GUESSER_SOURCE} target="_blank" rel="noopener noreferrer">
          Showdown heuristic
        </a>
      </div>
      {!suggestion && <p role="status">Calculating a spread…</p>}
      {suggestion && !suggestion.available && <p className="set-suggestion-note">{suggestion.reason}</p>}
      {suggestion?.available && (
        <>
          <p>
            <strong>{suggestion.role}</strong> · {describeSpread(suggestion.evs, genFromFormat(format))}
            {suggestion.nature ? ` · ${suggestion.nature}` : ''}
          </p>
          <p className="set-suggestion-note">
            Inferred from this Pokémon’s moves, item, ability and stats. This is a starting spread, not a
            matchup or speed benchmark. Applying changes EVs{suggestion.nature ? ' and nature' : ''}; IVs and
            other details stay as entered.
          </p>
          <button
            type="button"
            className="secondary-action"
            disabled={JSON.stringify(applySpreadSuggestion(set, suggestion)) === JSON.stringify(set)}
            onClick={() => {
              const next = applySpreadSuggestion(set, suggestion);
              setApplied({ before: structuredClone(set), after: JSON.stringify(next) });
              onChange(next);
            }}
          >
            Apply suggested spread
          </button>
        </>
      )}
      {canUndo && (
        <div className="set-suggestion-applied" role="status">
          <span>Suggested spread applied. You can adjust every value manually.</span>
          <button
            type="button"
            className="secondary-action"
            onClick={() => {
              onChange(applied.before);
              setApplied(undefined);
            }}
          >
            Undo suggested spread
          </button>
        </div>
      )}
    </section>
  );
}
