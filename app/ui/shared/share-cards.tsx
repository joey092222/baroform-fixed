"use client";

export type ResultShareCardInput = {
  title: string;
  responseCount: number;
  highlightQuestion: string;
  highlightResult: string;
  surveyUrl: string;
};

export type SurveyShareCardInput = {
  title: string;
  surveyUrl: string;
};

export function InstagramGlyph({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function drawCanvasRoundedRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  const corner = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + corner, y);
  context.arcTo(x + width, y, x + width, y + height, corner);
  context.arcTo(x + width, y + height, x, y + height, corner);
  context.arcTo(x, y + height, x, y, corner);
  context.arcTo(x, y, x + width, y, corner);
  context.closePath();
}

export function drawWrappedCanvasText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const characters = Array.from(text.trim());
  const lines: string[] = [];
  let line = "";

  characters.forEach((character) => {
    const nextLine = `${line}${character}`;
    if (line && context.measureText(nextLine).width > maxWidth) {
      lines.push(line.trim());
      line = character.trimStart();
    } else {
      line = nextLine;
    }
  });
  if (line) lines.push(line.trim());

  const visibleLines = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    let lastLine = visibleLines[maxLines - 1] ?? "";
    while (
      lastLine &&
      context.measureText(`${lastLine}…`).width > maxWidth
    ) {
      lastLine = lastLine.slice(0, -1);
    }
    visibleLines[maxLines - 1] = `${lastLine.trimEnd()}…`;
  }

  visibleLines.forEach((visibleLine, index) => {
    context.fillText(visibleLine, x, y + index * lineHeight);
  });
  return y + visibleLines.length * lineHeight;
}

export async function createInstagramSurveyCard({
  title,
  surveyUrl,
}: SurveyShareCardInput) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("설문 홍보 카드 캔버스를 만들지 못했어요.");

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#f8f9ff");
  background.addColorStop(0.56, "#edf1ff");
  background.addColorStop(1, "#fff6e9");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(900, 130, 10, 900, 130, 450);
  glow.addColorStop(0, "rgba(106, 128, 220, 0.36)");
  glow.addColorStop(1, "rgba(106, 128, 220, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#20345f";
  drawCanvasRoundedRect(context, 76, 68, 76, 76, 21);
  context.fill();
  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 94, 86, 19, 19, 5);
  context.fill();
  drawCanvasRoundedRect(context, 117, 109, 19, 19, 5);
  context.fill();

  context.fillStyle = "#20345f";
  context.font = '800 34px "Noto Sans KR Variable", sans-serif';
  context.fillText("BAROFORM", 178, 119);
  context.fillStyle = "#6676b6";
  context.font = '800 21px "Noto Sans KR Variable", sans-serif';
  context.fillText("SURVEY INVITATION", 765, 116);

  context.fillStyle = "#dfe6ff";
  drawCanvasRoundedRect(context, 76, 218, 254, 54, 27);
  context.fill();
  context.fillStyle = "#465caa";
  context.font = '800 22px "Noto Sans KR Variable", sans-serif';
  context.fillText("지금 참여해주세요", 105, 253);

  context.fillStyle = "#182640";
  context.font = '850 70px "Noto Sans KR Variable", sans-serif';
  const titleBottom = drawWrappedCanvasText(
    context,
    title || "우리 학교 설문",
    76,
    372,
    920,
    94,
    4,
  );

  context.fillStyle = "#68758f";
  context.font = '650 29px "Noto Sans KR Variable", sans-serif';
  context.fillText("당신의 답이 더 좋은 캠퍼스를 만들어요.", 80, titleBottom + 55);

  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 76, 790, 928, 322, 36);
  context.fill();
  context.strokeStyle = "#dce2f0";
  context.lineWidth = 2;
  context.stroke();

  context.fillStyle = "#20345f";
  context.font = '850 27px "Noto Sans KR Variable", sans-serif';
  context.fillText("로그인 없이 바로 참여", 126, 866);
  context.fillStyle = "#77839a";
  context.font = '620 23px "Noto Sans KR Variable", sans-serif';
  context.fillText("링크를 열고 설문을 완료해주세요.", 126, 913);

  context.fillStyle = "#20345f";
  drawCanvasRoundedRect(context, 126, 968, 828, 90, 22);
  context.fill();
  context.fillStyle = "#ffffff";
  context.font = '750 24px "Noto Sans KR Variable", sans-serif';
  const displayUrl = surveyUrl.replace(/^https?:\/\//, "");
  drawWrappedCanvasText(context, displayUrl, 164, 1022, 750, 31, 2);

  context.fillStyle = "#6d7a96";
  context.font = '650 22px "Noto Sans KR Variable", sans-serif';
  context.fillText("바로폼에서 만든 설문 · 익명 응답", 78, 1247);
  context.fillStyle = "#20345f";
  context.font = '800 22px "Noto Sans KR Variable", sans-serif';
  context.fillText("baroform", 875, 1247);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("설문 홍보 카드 이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

export async function createInstagramResultCard({
  title,
  responseCount,
  highlightQuestion,
  highlightResult,
  surveyUrl,
}: ResultShareCardInput) {
  await document.fonts.ready;
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 1350;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("결과 카드 캔버스를 만들지 못했어요.");

  const background = context.createLinearGradient(0, 0, 1080, 1350);
  background.addColorStop(0, "#f8f8ff");
  background.addColorStop(0.52, "#e9edff");
  background.addColorStop(1, "#dce5ff");
  context.fillStyle = background;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const glow = context.createRadialGradient(860, 160, 20, 860, 160, 460);
  glow.addColorStop(0, "rgba(115, 136, 226, 0.42)");
  glow.addColorStop(1, "rgba(115, 136, 226, 0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, canvas.width, canvas.height);

  context.fillStyle = "#273762";
  drawCanvasRoundedRect(context, 78, 70, 78, 78, 22);
  context.fill();
  context.fillStyle = "#ffffff";
  drawCanvasRoundedRect(context, 96, 88, 20, 20, 5);
  context.fill();
  drawCanvasRoundedRect(context, 119, 111, 20, 20, 5);
  context.fill();

  context.fillStyle = "#273762";
  context.font = '800 34px "Noto Sans KR Variable", sans-serif';
  context.fillText("BAROFORM", 180, 122);
  context.fillStyle = "#5969b0";
  context.font = '800 22px "Noto Sans KR Variable", sans-serif';
  context.fillText("RESULT CARD", 810, 119);

  context.fillStyle = "#172442";
  context.font = '850 60px "Noto Sans KR Variable", sans-serif';
  const titleBottom = drawWrappedCanvasText(
    context,
    title || "우리 학교 설문 결과",
    82,
    252,
    900,
    78,
    2,
  );

  context.fillStyle = "#6f7b9b";
  context.font = '650 26px "Noto Sans KR Variable", sans-serif';
  context.fillText("지금까지 모인 실제 응답", 84, titleBottom + 35);
  context.fillStyle = "#273762";
  context.font = '900 144px "Noto Sans KR Variable", sans-serif';
  context.fillText(responseCount.toLocaleString("ko-KR"), 80, titleBottom + 190);
  const countWidth = context.measureText(
    responseCount.toLocaleString("ko-KR"),
  ).width;
  context.font = '850 48px "Noto Sans KR Variable", sans-serif';
  context.fillText("개", 96 + countWidth, titleBottom + 187);

  const insightTop = Math.max(640, titleBottom + 255);
  context.fillStyle = "#273762";
  drawCanvasRoundedRect(context, 78, insightTop, 924, 400, 42);
  context.fill();
  context.fillStyle = "#9eaded";
  context.font = '800 23px "Noto Sans KR Variable", sans-serif';
  context.fillText("가장 눈에 띄는 결과", 130, insightTop + 72);
  context.fillStyle = "#ffffff";
  context.font = '750 35px "Noto Sans KR Variable", sans-serif';
  const questionBottom = drawWrappedCanvasText(
    context,
    highlightQuestion,
    130,
    insightTop + 135,
    820,
    48,
    3,
  );
  context.fillStyle = "#f2c66d";
  context.font = '900 53px "Noto Sans KR Variable", sans-serif';
  drawWrappedCanvasText(
    context,
    highlightResult,
    130,
    questionBottom + 34,
    820,
    66,
    2,
  );

  context.fillStyle = "#5f6d8f";
  context.font = '650 24px "Noto Sans KR Variable", sans-serif';
  context.fillText(
    `응답 ${responseCount.toLocaleString("ko-KR")}개 기준 · 개별 응답 내용은 포함하지 않았어요.`,
    82,
    1184,
  );
  context.fillStyle = "#273762";
  context.font = '800 25px "Noto Sans KR Variable", sans-serif';
  const displayUrl = surveyUrl.replace(/^https?:\/\//, "");
  context.fillText(displayUrl, 82, 1245);
  context.fillStyle = "#8190b5";
  context.font = '600 20px "Noto Sans KR Variable", sans-serif';
  context.fillText("이 결과는 참여 응답을 요약한 것으로 전체 학생을 대표하지 않을 수 있어요.", 82, 1295);

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("결과 카드 이미지를 만들지 못했어요."));
    }, "image/png");
  });
}

export function downloadResultShareFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function shareSurveyCardToInstagramApp({
  title,
  surveyUrl,
}: SurveyShareCardInput) {
  try {
    const blob = await createInstagramSurveyCard({ title, surveyUrl });
    const safeTitle = (title || "바로폼-설문")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()
      .slice(0, 45);
    const file = new File([blob], `${safeTitle || "바로폼-설문"}-참여.png`, {
      type: "image/png",
    });
    const caption = [
      title,
      "로그인 없이 바로 참여할 수 있어요.",
      `설문 참여하기 ${surveyUrl}`,
      "#바로폼 #대학생설문 #설문조사",
    ].join("\n");
    const canShareFile =
      typeof navigator.share === "function" &&
      (typeof navigator.canShare !== "function" || navigator.canShare({ files: [file] }));

    if (canShareFile) {
      try {
        await navigator.clipboard.writeText(caption);
      } catch {
        // Some mobile browsers hand the caption to the share target directly.
      }
      await navigator.share({ files: [file], title, text: caption });
      return "Instagram 공유창에 설문 카드를 전달하고 참여 문구를 복사했어요.";
    }

    downloadResultShareFile(file);
    try {
      await navigator.clipboard.writeText(caption);
      return "설문 카드 저장과 Instagram용 문구 복사를 완료했어요.";
    } catch {
      return "Instagram용 설문 카드를 저장했어요.";
    }
  } catch (shareError) {
    if (shareError instanceof DOMException && shareError.name === "AbortError") {
      return "설문 배포는 완료됐고 Instagram 공유는 취소했어요.";
    }
    return "설문은 배포됐지만 Instagram 카드를 열지 못했어요. 아래 버튼에서 다시 시도해주세요.";
  }
}

