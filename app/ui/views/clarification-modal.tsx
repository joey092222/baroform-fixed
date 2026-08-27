"use client";

import {
  ArrowRight,
  CircleHelp,
} from "lucide-react";
import {
  useState,
} from "react";
import type { ClarificationState } from "../../ux/state/use-survey-generation";

export function ClarificationModal({
  state,
  onChoose,
  onClose,
}: {
  state: ClarificationState;
  onChoose: (option: string) => void;
  onClose: () => void;
}) {
  const [answer, setAnswer] = useState("");
  const suggestedOptions = state.clarification.options.filter(
    (option) => !/^(?:직접\s*(?:설명|입력)|기타)/.test(option),
  );

  const submitAnswer = () => {
    const normalized = answer.replace(/\s+/g, " ").trim();
    if (normalized) onChoose(normalized);
  };

  return (
    <div className="generation-overlay" role="dialog" aria-modal="true">
      <div className="clarification-card">
        <span className="clarification-icon">
          <CircleHelp size={24} />
        </span>
        <span className="clarification-label">정확한 설문을 위해 한 가지만</span>
        <h2>{state.clarification.question}</h2>
        <p>{state.clarification.reason}</p>
        {state.research.sources.length > 0 && (
          <small>공개 자료를 확인했지만 이 부분은 임의로 정하지 않았어요.</small>
        )}
        <div className="clarification-options">
          {suggestedOptions.map((option) => (
            <button type="button" key={option} onClick={() => onChoose(option)}>
              {option}
              <ArrowRight size={15} />
            </button>
          ))}
        </div>
        <form
          className="clarification-answer"
          onSubmit={(event) => {
            event.preventDefault();
            submitAnswer();
          }}
        >
          <label htmlFor="clarification-answer">직접 알려주기</label>
          <div>
            <input
              id="clarification-answer"
              value={answer}
              onChange={(event) => setAnswer(event.target.value)}
              placeholder="예: 학생회관에 있는 교내 식당이에요"
              maxLength={180}
              autoFocus
            />
            <button type="submit" disabled={!answer.trim()} aria-label="답변 보내기">
              <ArrowRight size={17} />
            </button>
          </div>
          <small>Enter를 누르면 이 설명을 반영해 바로 설계해요.</small>
        </form>
        <button className="clarification-close" type="button" onClick={onClose}>
          처음 문장을 다시 적을게요
        </button>
      </div>
    </div>
  );
}

