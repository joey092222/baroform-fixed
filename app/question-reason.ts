const trailingSentenceMarks = /[\s.!?。！？]+$/u;

function nominalizeKoreanStem(stem: string) {
  if (!stem) return stem;

  const characters = Array.from(stem);
  const last = characters.at(-1);
  if (!last) return stem;

  const code = last.charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return `${stem}함`;

  const offset = code - 0xac00;
  const jongseong = offset % 28;
  const base = code - jongseong;

  if (jongseong === 0) {
    characters[characters.length - 1] = String.fromCharCode(base + 16);
    return characters.join("");
  }

  if (jongseong === 4) {
    characters[characters.length - 1] = String.fromCharCode(base + 16);
    return characters.join("");
  }

  if (jongseong === 8) {
    characters[characters.length - 1] = String.fromCharCode(base + 10);
    return characters.join("");
  }

  return `${stem}음`;
}

export function formatQuestionReason(value: string) {
  let text = value.replace(/\s+/g, " ").trim().replace(trailingSentenceMarks, "");
  if (!text) return "";

  if (/(?:함|했음|됨|됐음|있음|없음|임|였음|음)$/u.test(text)) {
    return `${text}.`;
  }

  text = text
    .replace(/하기 위한 질문(?:이에요|입니다)$/u, "함")
    .replace(/했습니다$/u, "했음")
    .replace(/했어요$/u, "했음")
    .replace(/합니다$/u, "함")
    .replace(/해요$/u, "함")
    .replace(/한다$/u, "함")
    .replace(/할 수 (?:있습니다|있어요|있다)$/u, "함")
    .replace(/(?:이에요|예요|입니다)$/u, "임")
    .replace(/됐어요$/u, "됐음")
    .replace(/돼요$/u, "됨");

  if (!/(?:함|했음|됨|됐음|있음|없음|임|였음|음)$/u.test(text)) {
    if (/을 수 (?:있습니다|있어요|있다)$/u.test(text)) {
      text = nominalizeKoreanStem(
        text.replace(/을 수 (?:있습니다|있어요|있다)$/u, ""),
      );
    } else if (/여요$/u.test(text)) {
      text = `${text.slice(0, -2)}임`;
    } else if (/(?:아요|어요)$/u.test(text)) {
      text = nominalizeKoreanStem(text.slice(0, -2));
    } else if (/다$/u.test(text)) {
      text = nominalizeKoreanStem(text.slice(0, -1));
    } else {
      text = `${text}을 확인함`;
    }
  }

  return `${text}.`;
}
