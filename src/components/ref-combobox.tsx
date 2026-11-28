"use client";

import { useId, useState, type KeyboardEvent } from "react";
import { inputClass } from "@/components/form";
import { BranchIcon } from "@/components/icons";
import { commitRange, formatShortDate, refSuggestions } from "@/lib/helpers";
import type { CommitOption, RefSuggestion } from "@/types/dashboard.types";

export function RefCombobox({ id, name, branches, commits, compareBranch }: { id: string; name: string; branches: string[]; commits: CommitOption[]; compareBranch: string }) {
  const listId = useId();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  const suggestions = refSuggestions(value, branches, commits, compareBranch);
  const picked = commits.find((commit) => value === commitRange(commit.sha));
  const showList = open && suggestions.length > 0;

  const choose = (suggestion: RefSuggestion) => {
    setValue(suggestion.value);
    setOpen(false);
    setActive(-1);
  }

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((current) => (suggestions.length === 0 ? -1 : (current + step + suggestions.length) % suggestions.length));
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault();
      choose(suggestions[active]);
    } else if (event.key === "Escape" && showList) {
      event.preventDefault();
      setOpen(false);
    }
  }

  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        value={value}
        required
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listId}
        aria-activedescendant={showList && active >= 0 ? `${listId}-${active}` : undefined}
        placeholder="Type a branch, commit message or PR number"
        className={inputClass}
        onChange={(event) => {
          setValue(event.target.value);
          setOpen(true);
          setActive(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKeyDown}
      />
      {picked && <p className="mt-1.5 truncate text-xs text-muted">Commit: {picked.subject}</p>}
      {showList && (
        <ul id={listId} role="listbox" className="absolute top-full right-0 left-0 z-20 mt-1 max-h-80 overflow-y-auto rounded-md border bg-background py-1 shadow-lg">
          {suggestions.map((suggestion, i) => {
            const startsGroup = i === 0 || suggestions[i - 1].kind !== suggestion.kind;
            return (
              <li key={`${suggestion.kind}:${suggestion.value}`} role="presentation">
                {startsGroup && <p className="px-3 pt-2 pb-1 text-xs font-medium text-subtle">{suggestion.kind === "branch" ? "Branches" : `Recent commits on ${compareBranch}`}</p>}
                <div
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => choose(suggestion)}
                  className={`flex cursor-pointer items-center gap-2.5 px-3 py-1.5 text-sm ${i === active ? "bg-hover" : ""}`}
                >
                  {suggestion.kind === "branch" ? (
                    <>
                      <BranchIcon />
                      <span className="truncate">{suggestion.name}</span>
                    </>
                  ) : (
                    <>
                      <span className="shrink-0 font-mono text-xs text-muted">{suggestion.commit.sha}</span>
                      <span className="min-w-0 flex-1 truncate">{suggestion.commit.subject}</span>
                      <span className="shrink-0 text-xs text-subtle">{formatShortDate(suggestion.commit.date)}</span>
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
