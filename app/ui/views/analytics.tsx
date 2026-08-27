"use client";

import {
  useEffect,
  useState,
} from "react";
import {
  ResultsDashboard,
} from "../../results-dashboard";
import {
  downloadSurveyCsv,
  downloadSurveyExcel,
  downloadSurveyWord,
} from "../../survey-export";
import {
  surveySharePath,
} from "../../survey-share";
import {
  type Question,
  type StoredResponse,
} from "../../ux/types";
import { fetchSurveyResponses } from "../../ux/data/surveys";
import {
  createInstagramResultCard,
  downloadResultShareFile,
} from "../shared/share-cards";

export function RealAnalyticsView({
  onHome,
  title,
  slug,
  manageToken,
  questions,
}: {
  onHome: () => void;
  title: string;
  slug: string;
  manageToken: string;
  questions: Question[];
}) {
  const [responses, setResponses] = useState<StoredResponse[]>([]);
  const [loading, setLoading] = useState(Boolean(slug && manageToken));
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState<"excel" | "word" | "csv" | null>(
    null,
  );
  const [exportError, setExportError] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareStatus, setShareStatus] = useState("");

  useEffect(() => {
    if (!slug || !manageToken) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const loaded = await fetchSurveyResponses(slug, manageToken);
        if (!cancelled) setResponses(loaded);
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "결과를 불러오지 못했어요.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, manageToken]);

  const analysisResponses = responses.filter((response) => response.quality?.status !== "exclude");

  const questionSummaries = questions
    .filter((question) => question.type !== "section")
    .map((question) => {
    const values = analysisResponses
      .map(
        (response) =>
          response.answers.find(
            (answer) => answer.questionId === question.id,
          )?.value,
      )
      .filter((value) => value !== undefined && value !== "");

    if (question.type === "scale") {
      const numbers = values.filter(
        (value): value is number => typeof value === "number",
      );
      const average =
        numbers.length > 0
          ? numbers.reduce((total, value) => total + value, 0) / numbers.length
          : 0;
      return {
        question,
        label: numbers.length > 0 ? `평균 ${average.toFixed(1)} / 5` : "응답 없음",
        percentage: numbers.length > 0 ? (average / 5) * 100 : 0,
      };
    }

    if (question.type === "single" || question.type === "multiple") {
      const counts = new Map<string, number>();
      values.forEach((value) => {
        if (typeof value === "string") {
          counts.set(value, (counts.get(value) ?? 0) + 1);
        } else if (Array.isArray(value)) {
          value.forEach((choice) =>
            counts.set(choice, (counts.get(choice) ?? 0) + 1),
          );
        }
      });
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      return {
        question,
        label: top ? `${top[0]} · ${top[1]}명` : "응답 없음",
        percentage:
          top && analysisResponses.length > 0 ? (top[1] / analysisResponses.length) * 100 : 0,
      };
    }

    return {
      question,
      label: values.length > 0 ? `주관식 ${values.length}개` : "응답 없음",
      percentage:
        analysisResponses.length > 0 ? (values.length / analysisResponses.length) * 100 : 0,
    };
    });

  const shareSummary = questionSummaries.find(
    (summary) => summary.label !== "응답 없음",
  );
  const shareQuestion =
    shareSummary?.question.title ?? "우리 학교의 의견을 모으고 있어요.";
  const shareResult =
    shareSummary?.label ?? `${analysisResponses.length.toLocaleString("ko-KR")}개의 응답`;
  const sharePath = slug ? surveySharePath(slug) : "/";

  const createResultShareFile = async () => {
    const surveyUrl = `${window.location.origin}${sharePath}`;
    const blob = await createInstagramResultCard({
      title: title || "우리 학교 설문 결과",
      responseCount: analysisResponses.length,
      highlightQuestion: shareQuestion,
      highlightResult: shareResult,
      surveyUrl,
    });
    const safeTitle = (title || "바로폼-설문-결과")
      .replace(/[\\/:*?"<>|]/g, "")
      .trim()
      .slice(0, 45);
    const file = new File([blob], `${safeTitle || "바로폼-설문-결과"}.png`, {
      type: "image/png",
    });
    const caption = [
      `${title || "우리 학교 설문"} 결과`,
      `품질 확인을 통과한 ${analysisResponses.length.toLocaleString("ko-KR")}개의 응답을 분석했어요.`,
      `${shareQuestion}: ${shareResult}`,
      `설문 참여하기 ${surveyUrl}`,
      "#바로폼 #대학생설문 #설문결과",
    ].join("\n");
    return { file, caption };
  };

  const shareResultToInstagram = async () => {
    if (analysisResponses.length === 0 || sharing) return;
    setSharing(true);
    setShareStatus("");
    try {
      const { file, caption } = await createResultShareFile();
      const canShareFile =
        typeof navigator.share === "function" &&
        (typeof navigator.canShare !== "function" ||
          navigator.canShare({ files: [file] }));

      if (canShareFile) {
        setShareStatus("공유 앱 목록에서 Instagram을 선택해주세요.");
        await navigator.share({
          files: [file],
          title: `${title || "바로폼 설문"} 결과`,
          text: caption,
        });
        setShareStatus("결과 카드를 공유했어요.");
      } else {
        downloadResultShareFile(file);
        try {
          await navigator.clipboard.writeText(caption);
          setShareStatus(
            "이미지를 저장하고 인스타그램용 캡션도 복사했어요.",
          );
        } catch {
          setShareStatus(
            "이미지를 저장했어요. 인스타그램에서 사진을 선택해주세요.",
          );
        }
      }
    } catch (shareError) {
      if (shareError instanceof DOMException && shareError.name === "AbortError") {
        setShareStatus("공유를 취소했어요.");
      } else {
        setShareStatus("결과 카드를 만들지 못했어요. 다시 시도해주세요.");
      }
    } finally {
      setSharing(false);
    }
  };

  const downloadInstagramCard = async () => {
    if (analysisResponses.length === 0 || sharing) return;
    setSharing(true);
    setShareStatus("");
    try {
      const { file, caption } = await createResultShareFile();
      downloadResultShareFile(file);
      try {
        await navigator.clipboard.writeText(caption);
        setShareStatus("카드 이미지 저장과 캡션 복사를 완료했어요.");
      } catch {
        setShareStatus("카드 이미지를 저장했어요.");
      }
    } catch {
      setShareStatus("결과 카드를 만들지 못했어요. 다시 시도해주세요.");
    } finally {
      setSharing(false);
    }
  };

  const exportResults = async (format: "excel" | "word" | "csv") => {
    if (responses.length === 0 || exporting) return;
    setExporting(format);
    setExportError("");
    const payload = { title, questions, responses };
    try {
      if (format === "excel") {
        await downloadSurveyExcel(payload);
      } else if (format === "word") {
        await downloadSurveyWord(payload);
      } else {
        downloadSurveyCsv(payload);
      }
    } catch {
      setExportError("결과 파일을 만들지 못했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <ResultsDashboard
      title={title}
      slug={slug}
      responses={responses}
      questions={questions}
      state={
        !slug || !manageToken
          ? "missing"
          : loading
            ? "loading"
            : error
              ? "error"
              : "ready"
      }
      error={error}
      exporting={exporting}
      exportError={exportError}
      shareOpen={shareOpen}
      sharing={sharing}
      shareStatus={shareStatus}
      shareQuestion={shareQuestion}
      shareResult={shareResult}
      sharePath={sharePath}
      onHome={onHome}
      onExport={(format) => void exportResults(format)}
      onOpenShare={() => {
        setShareStatus("");
        setShareOpen(true);
      }}
      onCloseShare={() => setShareOpen(false)}
      onShareToInstagram={() => void shareResultToInstagram()}
      onDownloadShare={() => void downloadInstagramCard()}
    />
  );
}

