"use client";

import {
  ArrowRight,
  BarChart3,
  Clock3,
  Link2,
  Share2,
  Sparkles,
  UsersRound,
} from "lucide-react";
import {
  categoryLabel,
} from "../../survey-board";
import {
  type PublicSurvey,
} from "../../ux/types";
import {
  BrandMark,
  Footer,
} from "../shared/chrome";
import {
  InstagramGlyph,
} from "../shared/share-cards";

export function LandingView({
  onEnterSite,
  surveys,
  loadingSurveys,
}: {
  onEnterSite: () => void;
  surveys: PublicSurvey[];
  loadingSurveys: boolean;
}) {
  const fallbackSurveys: PublicSurvey[] = [
    { slug: "sample-1", title: "학교 도서관 이용 경험 조사", description: "", ownerName: "경영대 프로젝트팀", schoolId: "yonsei", category: "campus", campus: "신촌캠퍼스", durationMinutes: 3, rewardCash: 30, questionCount: 12, responseCount: 48 },
    { slug: "sample-2", title: "대학생 인턴 준비 과정 조사", description: "", ownerName: "진로 학회", schoolId: "yonsei", category: "career", campus: "신촌캠퍼스", durationMinutes: 5, rewardCash: 50, questionCount: 15, responseCount: 73 },
    { slug: "sample-3", title: "일정 관리 앱 사용성 평가", description: "", ownerName: "UX 리서치팀", schoolId: "yonsei", category: "research", campus: "신촌캠퍼스", durationMinutes: 4, rewardCash: 50, questionCount: 14, responseCount: 31 },
    { slug: "sample-4", title: "축제 참여자 만족도 조사", description: "", ownerName: "학생기획단", schoolId: "yonsei", category: "club", campus: "신촌캠퍼스", durationMinutes: 2, rewardCash: 30, questionCount: 9, responseCount: 126 },
    { slug: "sample-5", title: "대학생 소비 습관 연구", description: "", ownerName: "소비자행동 연구팀", schoolId: "yonsei", category: "course", campus: "신촌캠퍼스", durationMinutes: 7, rewardCash: 70, questionCount: 18, responseCount: 54 },
    { slug: "sample-6", title: "교내 편의시설 만족도", description: "", ownerName: "캠퍼스 개선팀", schoolId: "yonsei", category: "campus", campus: "신촌캠퍼스", durationMinutes: 3, rewardCash: 30, questionCount: 11, responseCount: 92 },
  ];
  const hasLiveSurveys = surveys.length > 0;
  const marqueeSurveys = hasLiveSurveys ? surveys.slice(0, 12) : fallbackSurveys;
  const surveyRows = [
    marqueeSurveys.filter((_, index) => index % 2 === 0),
    marqueeSurveys.filter((_, index) => index % 2 === 1),
  ].filter((row) => row.length > 0);

  return (
    <>
      <main className="landing-page">
        <nav className="landing-nav" aria-label="랜딩 페이지 메뉴">
          <button type="button" className="brand" onClick={onEnterSite} aria-label="바로폼 홈으로 이동">
            <BrandMark />
            <strong>바로폼</strong>
          </button>
          <div>
            <a href="#product">제품</a>
            <a href="#how-it-works">이용 방법</a>
            <a href="#campus-surveys">학교 설문</a>
          </div>
          <button type="button" className="landing-nav-cta" onClick={onEnterSite}>
            무료로 시작하기 <ArrowRight size={16} />
          </button>
        </nav>

        <section className="landing-hero" aria-labelledby="landing-title">
          <div className="landing-hero-glow landing-hero-glow-left" />
          <div className="landing-hero-glow landing-hero-glow-right" />
          <div className="landing-hero-content">
            <span className="landing-kicker">대학생의 질문이 실제 응답이 되는 곳</span>
            <h1 id="landing-title">학생들의 질문과 답을 한곳에서.</h1>
            <p>한 문장으로 설문을 만들고, 우리 학교에서 응답을 모으고, 결과까지 바로 읽어보세요.</p>
            <div className="landing-hero-actions">
              <button
                type="button"
                className="landing-primary"
                onClick={onEnterSite}
              >
                첫 설문 만들기
                <ArrowRight size={18} />
              </button>
            </div>
            <div className="landing-product-frame" id="product" aria-label="바로폼 제품 화면 예시">
              <div className="landing-product-bar">
                <span><BrandMark compact /><strong>바로폼</strong></span>
                <div><i /><i /><i /></div>
              </div>
              <div className="landing-product-layout">
                <aside>
                  <span>설문 구성</span>
                  {["설문 소개", "이용 빈도", "선택 이유", "개선 의견"].map((item, index) => (
                    <i key={item} className={index === 1 ? "active" : ""}>{String(index).padStart(2, "0")} {item}</i>
                  ))}
                </aside>
                <article>
                  <small>BAROFORM</small>
                  <h2>대학생 카페 공부 경험 조사</h2>
                  <p>카페에서 공부하는 빈도와 선택 이유를 알아보는 설문입니다.</p>
                  <div className="landing-question-mockup">
                    <span>01</span>
                    <strong>평소 카페에서 얼마나 자주 공부하나요?</strong>
                    {["거의 하지 않음", "월 1~2회", "주 1~2회", "주 3회 이상"].map((option) => <i key={option}>{option}</i>)}
                  </div>
                </article>
                <aside className="landing-ai-panel">
                  <strong><Sparkles size={15} /> AI로 바로 수정</strong>
                  <p>질문을 더 짧게 정리하고 선택지 간격을 맞춰줘</p>
                  <button type="button" tabIndex={-1}>AI로 반영하기</button>
                </aside>
              </div>
            </div>
          </div>
        </section>

        <section className="landing-proof-strip" aria-label="바로폼 핵심 흐름">
          <span>AI 설문 설계</span><i />
          <span>학교 응답 모집</span><i />
          <span>실시간 결과 분석</span><i />
          <span>결과 카드 공유</span>
        </section>

        <section className="landing-story" id="how-it-works" aria-labelledby="landing-story-title">
          <div className="landing-container landing-story-heading">
            <span className="landing-eyebrow">설문을 만드는 새로운 방식</span>
            <h2 id="landing-story-title">질문은 짧게.<br />설계는 정확하게.</h2>
            <p>무엇을 조사할지 한 문장으로 알려주세요. 바로폼이 사용자의 의도를 읽고 측정 가능한 질문으로 구성합니다.</p>
          </div>
          <div className="landing-container landing-feature-stack">
            <article className="landing-feature-row">
              <div>
                <span>01 · CREATE</span>
                <h3>한 문장이 설문 초안이 됩니다.</h3>
                <p>참고 링크, 문서, 이미지를 함께 넣으면 맥락까지 반영합니다. 불필요한 되묻기는 줄이고 요청한 핵심을 바로 측정합니다.</p>
              </div>
              <div className="landing-feature-visual create-visual">
                <span>대학생들의 SNS 이용 시간을 조사하고 싶어요</span>
                <div><Link2 size={16} /> 참고 링크</div>
                <button type="button" tabIndex={-1}><Sparkles size={16} /> AI로 설문 만들기</button>
              </div>
            </article>
            <article className="landing-feature-row reverse">
              <div>
                <span>02 · DISTRIBUTE</span>
                <h3>만든 즉시, 필요한 응답자에게.</h3>
                <p>학교 게시판, 공유 링크, Instagram용 카드까지 한 번에 준비합니다. 응답자는 로그인 없이 바로 참여할 수 있습니다.</p>
              </div>
              <div className="landing-feature-visual publish-visual">
                <div className="landing-share-card">
                  <small>YONSEI CAMPUS SURVEY</small>
                  <strong>학교 도서관<br />이용 경험 조사</strong>
                  <span>약 3분 · 50C</span>
                </div>
                <div className="landing-share-actions">
                  <span><Share2 size={16} /> 링크 배포</span>
                  <span><InstagramGlyph size={16} /> Instagram</span>
                </div>
              </div>
            </article>
            <article className="landing-feature-row">
              <div>
                <span>03 · ANALYZE</span>
                <h3>응답 수보다 먼저, 응답의 품질을 봅니다.</h3>
                <p>실시간 분포, 주요 인사이트, 품질 주의 응답을 한 화면에서 확인하고 CSV·Excel·Word로 내보낼 수 있습니다.</p>
              </div>
              <div className="landing-feature-visual analytics-visual">
                <div><span>분석 가능 응답</span><strong>94</strong><small>/ 전체 100</small></div>
                <div className="landing-bars"><i style={{ width: "82%" }} /><i style={{ width: "58%" }} /><i style={{ width: "36%" }} /></div>
                <p><Sparkles size={16} /> 응답자의 62%가 저녁 시간대 이용을 선호해요.</p>
              </div>
            </article>
          </div>
        </section>

        <section className="landing-survey-showcase" id="campus-surveys" aria-labelledby="survey-showcase-title">
          <div className="landing-container landing-showcase-heading">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">{hasLiveSurveys ? "지금 우리 학교" : "설문 예시"}</span>
              <h2 id="survey-showcase-title">
                {loadingSurveys ? "설문을 불러오는 중" : hasLiveSurveys ? "지금 열려 있는 설문" : "이런 설문을 만들 수 있어요"}
              </h2>
            </div>
            <button type="button" className="landing-board-link" onClick={onEnterSite}>
              전체 설문 보기 <ArrowRight size={16} />
            </button>
          </div>
          <div className="landing-survey-marquee" aria-label={hasLiveSurveys ? "현재 참여 가능한 설문" : "설문 예시"}>
            {surveyRows.map((row, rowIndex) => (
              <div className="survey-marquee-row" key={`survey-row-${rowIndex}`}>
                <div className={`survey-marquee-track${rowIndex === 1 ? " is-reverse" : ""}`}>
                  {[0, 1].map((copyIndex) => (
                    <div
                      className="survey-marquee-group"
                      key={`survey-group-${rowIndex}-${copyIndex}`}
                      aria-hidden={copyIndex === 1}
                    >
                      {row.map((survey) => (
                        <article className="landing-survey-card" key={`${copyIndex}-${survey.title}`}>
                          <div className="survey-card-topline">
                            <span>{categoryLabel(survey.category)}</span>
                            <strong>+{survey.rewardCash}C</strong>
                          </div>
                          <h3>{survey.title}</h3>
                          <p><Clock3 size={13} />약 {survey.durationMinutes}분</p>
                        </article>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="landing-section landing-process">
          <div className="landing-container">
            <div className="landing-section-heading">
              <span className="landing-eyebrow">왜 바로폼인가</span>
              <h2>설문 제작부터 응답 수집까지 한곳에서.</h2>
            </div>
            <div className="landing-step-grid">
              <article>
                <span>01</span>
                <div className="landing-step-icon"><Sparkles size={22} /></div>
                <h3>의도를 읽는 AI</h3>
                <p>주제의 의미를 그대로 해석해 바로 측정할 질문을 만듭니다.</p>
              </article>
              <article>
                <span>02</span>
                <div className="landing-step-icon"><UsersRound size={22} /></div>
                <h3>캠퍼스 응답망</h3>
                <p>새 설문과 외부 설문 모두 학교 구성원에게 빠르게 알립니다.</p>
              </article>
              <article>
                <span>03</span>
                <div className="landing-step-icon"><BarChart3 size={22} /></div>
                <h3>읽히는 결과</h3>
                <p>실시간 분석과 공유 카드로 조사 결과를 다시 확산시킵니다.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="landing-final-cta">
          <div>
            <span>질문 하나에서 시작하세요</span>
            <h2>학생들의 의견을 바로 만나보세요.</h2>
          </div>
          <div className="landing-final-actions">
            <button type="button" onClick={onEnterSite}>
              무료로 시작하기 <ArrowRight size={19} />
            </button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}

