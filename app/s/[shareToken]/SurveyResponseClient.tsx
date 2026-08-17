"use client";

import BaroformApp from "@/app/page";
import type { PublicSurveyData } from "@/app/lib/public-survey";

export default function SurveyResponseClient({
  survey,
}: {
  survey: PublicSurveyData;
}) {
  return <BaroformApp initialSurvey={survey} />;
}
