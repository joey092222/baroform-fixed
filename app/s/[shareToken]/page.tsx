import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  getPublicSurvey,
} from "@/app/lib/public-survey";
import {
  buildSurveyMetadata,
  buildUnavailableSurveyMetadata,
} from "@/app/survey-share";
import SurveyResponseClient from "./SurveyResponseClient";

type SurveySharePageProps = {
  params: Promise<{ shareToken: string }>;
};

export const revalidate = 300;

async function readPublicSurvey(shareToken: string) {
  try {
    return await getPublicSurvey(shareToken);
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: SurveySharePageProps): Promise<Metadata> {
  const { shareToken } = await params;
  const survey = await readPublicSurvey(shareToken);
  return survey
    ? buildSurveyMetadata(survey)
    : buildUnavailableSurveyMetadata(shareToken);
}

export default async function SurveySharePage({ params }: SurveySharePageProps) {
  const { shareToken } = await params;
  const survey = await readPublicSurvey(shareToken);
  if (!survey) notFound();

  return <SurveyResponseClient survey={survey} />;
}
