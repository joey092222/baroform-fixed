"use client";

import { CircleHelp } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { analyzeSurveyPrompt } from "./survey-intent";
import { schoolLabel, type SurveyCategory } from "./survey-board";
import { surveySharePath } from "./survey-share";
import CommunityView from "./ui/views/community";
import { WorkspaceReviewView, WorkspaceView } from "./ui/views/workspace";
import {
  managedSurvey,
  useNavigation,
  usePublish,
  useSession,
  useSurveyCatalog,
  useSurveyClaim,
  useSurveyDraft,
  useSurveyGeneration,
  useToast,
  type AppView,
  type OwnedSurvey,
  type PublicSurvey,
  surveyEditing,
} from "./ux";
import { Footer, Header, WorkspaceSidebar } from "./ui/shared/chrome";
import { shareSurveyCardToInstagramApp } from "./ui/shared/share-cards";
import { LandingView } from "./ui/views/landing";
import { ProductHomeView } from "./ui/views/home";
import { CampusPulseBoardView } from "./ui/views/pulses";
import { SchoolBoardView } from "./ui/views/board";
import { MyPageView } from "./ui/views/mypage";
import { CreateView } from "./ui/views/create";
import { AuthModal } from "./ui/views/auth-modal";
import { ClarificationModal } from "./ui/views/clarification-modal";
import { rewardCashForDuration } from "./rewards";
import { EditorView } from "./ui/views/editor";
import { PublishModal, PublishedView } from "./ui/views/publish";
import { SurveyView } from "./ui/views/respond";
import { RealAnalyticsView } from "./ui/views/analytics";
import { GenerationOverlay } from "./ui/views/generation-overlay";

const seedBlueprint = analyzeSurveyPrompt("신입생 학교생활 적응 조사");

/** Screens that sit inside the signed-in app shell (header + sidebar). */
const appShellViews: ReadonlySet<AppView> = new Set<AppView>([
  "home",
  "board",
  "pulses",
  "community",
  "workspace",
  "mypage",
]);

/**
 * Composition only.
 *
 * Every rule, flow, and request lives in `./ux`; every pixel lives in `./ui`.
 * This file just wires one to the other, which is why `./ui` can be replaced
 * wholesale without touching behavior. See docs/UX-SPEC.md.
 */
export default function Home({
  initialSurvey = null,
}: {
  initialSurvey?: PublicSurvey | null;
} = {}) {
  const toast = useToast();
  const session = useSession();
  const [authOpen, setAuthOpen] = useState(false);
  const [publishOpen, setPublishOpen] = useState(false);
  const [instagramStatus, setInstagramStatus] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const requireAuth = useCallback(() => setAuthOpen(true), []);

  const catalog = useSurveyCatalog({
    authToken: session.authToken,
    onUnauthorized: () => {
      session.signOutLocally();
      requireAuth();
    },
  });

  const draft = useSurveyDraft({
    initialTitle: seedBlueprint.title,
    initialDescription: seedBlueprint.description,
    initialQuestions: seedBlueprint.aiQuestions,
  });

  const publish = usePublish({
    authToken: session.authToken,
    isSignedIn: session.isSignedIn,
    onUnauthorized: () => {
      session.signOutLocally();
      requireAuth();
    },
  });

  const nav = useNavigation({
    initialView: initialSurvey ? "survey" : "landing",
    onNavigate: (nextView) => {
      setSidebarOpen(false);
      if (nextView === "board") void catalog.refreshPublic();
      if (nextView === "mypage" && session.authToken) {
        void catalog.refreshMine(session.authToken);
      }
    },
    onEntry: (intent) => {
      if (initialSurvey) {
        catalog.setActiveSurvey(initialSurvey);
        nav.setView("survey");
        return;
      }
      if (intent.kind === "survey") {
        catalog
          .openSurveyBySlug(intent.slug)
          .then(() => nav.setView("survey"))
          .catch((loadError) =>
            toast.show(
              loadError instanceof Error
                ? loadError.message
                : "설문을 불러오지 못했어요.",
              "long",
            ),
          );
        return;
      }
      if (intent.kind === "app") nav.setView("home");
    },
  });

  const generation = useSurveyGeneration({
    surveyMode: draft.surveyMode,
    targetGrade: draft.targetGrade,
    questionCount: draft.questionCount,
    references: draft.references,
    onReady: (ready) => {
      draft.replaceDocument(ready);
      draft.setPrompt(ready.prompt);
      nav.navigate("editor");
    },
    onError: (message) => toast.show(message, "error"),
  });

  // Reconnect a survey published in an earlier visit, then load the account's data.
  useSurveyClaim({
    authToken: session.authToken,
    onSettled: async (token) => {
      await catalog.refreshMine(token);
      await session.refreshWallet(token);
    },
  });

  // Restore the locally held handle so results stay reachable after a reload.
  useEffect(() => {
    const snapshot = managedSurvey.readManagedSurvey();
    if (!snapshot) return;
    publish.adoptOwnedSurvey(snapshot);
    draft.replaceDocument({
      title: snapshot.title,
      description: draft.description,
      questions: snapshot.questions,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updatePrompt = useCallback(
    (value: string) => {
      generation.invalidate();
      draft.setPrompt(value);
    },
    [draft, generation],
  );

  const updateReferences = useCallback(
    (value: Parameters<typeof draft.setReferences>[0]) => {
      generation.invalidate();
      draft.setReferences(value);
    },
    [draft, generation],
  );

  const startCreate = useCallback(
    async (promptOverride?: string) => {
      const result = await generation.start(promptOverride ?? draft.prompt);
      if (result.status !== "rejected") return;
      toast.show(result.rejection.message);
      if (result.rejection.reason === "empty-input") {
        document.getElementById("survey-maker")?.focus();
      }
    },
    [draft.prompt, generation, toast],
  );

  const openSurvey = useCallback(
    async (survey: PublicSurvey) => {
      if (survey.source === "external" && survey.externalUrl) {
        void catalog.visitExternalSurvey(survey);
        window.open(survey.externalUrl, "_blank", "noopener,noreferrer");
        return;
      }
      toast.show("설문을 불러오고 있어요.", 60_000);
      try {
        await catalog.openSurveyBySlug(survey.slug);
        nav.setView("survey");
        nav.showSurveyUrl(survey.slug);
        window.scrollTo({ top: 0 });
        toast.clear();
      } catch (loadError) {
        toast.show(
          loadError instanceof Error
            ? loadError.message
            : "설문을 불러오지 못했어요.",
          "long",
        );
      }
    },
    [catalog, nav, toast],
  );

  const openOwnedAnalytics = useCallback(
    (survey: OwnedSurvey) => {
      publish.adoptOwnedSurvey(survey);
      draft.replaceDocument({
        title: survey.title,
        description: survey.description,
        questions: survey.questions ?? [],
      });
      catalog.setActiveSurvey(survey);
      nav.navigate("analytics");
    },
    [catalog, draft, nav, publish],
  );

  const publishSurvey = useCallback(
    async (
      ownerName: string,
      listingRequested: boolean,
      category: SurveyCategory,
      shareToInstagram: boolean,
      targetResponses: number,
    ) => {
      setInstagramStatus("");
      const outcome = await publish.publish(
        { ownerName, listingRequested, category, targetResponses },
        {
          title: draft.title,
          description: draft.description,
          questions: draft.questions,
          targetGrade: draft.targetGrade,
        },
      );

      if (outcome.status === "requires-auth") {
        setPublishOpen(false);
        requireAuth();
        return;
      }
      if (outcome.status === "failed") return;

      catalog.setActiveSurvey(outcome.survey);
      if (outcome.created.isListed) {
        catalog.prependPublicSurvey(outcome.survey);
        void catalog.refreshPublic();
      }
      if (session.authToken) void catalog.refreshMine(session.authToken);

      if (shareToInstagram) {
        const surveyUrl = new URL(
          surveySharePath(outcome.created.slug),
          window.location.origin,
        ).toString();
        setInstagramStatus(
          await shareSurveyCardToInstagramApp({
            title: outcome.created.title,
            surveyUrl,
          }),
        );
      }
      setPublishOpen(false);
      nav.navigate("published");
    },
    [catalog, draft, nav, publish, requireAuth, session.authToken],
  );

  const deleteOwnedSurvey = useCallback(
    async (survey: OwnedSurvey) => {
      if (!session.authToken) {
        requireAuth();
        throw new Error("설문을 삭제하려면 로그인해주세요.");
      }
      await catalog.removeOwnedSurvey(survey);
      publish.forgetIfSlug(survey.slug);
      toast.show("설문과 저장된 응답을 삭제했어요.");
    },
    [catalog, publish, requireAuth, session.authToken, toast],
  );

  const duplicateWorkspaceSurvey = useCallback(
    (slug: string) => {
      const source = catalog.mySurveys.find((survey) => survey.slug === slug);
      if (!source?.questions?.length) {
        toast.show("복제할 설문 문항을 불러오지 못했어요.");
        return;
      }
      draft.loadFromSurvey({
        title: source.title,
        description: source.description,
        questions: source.questions,
      });
      nav.navigate("editor");
      toast.show(
        "지난 설문을 복제했어요. 수정한 뒤 새 설문으로 배포할 수 있어요.",
        "long",
      );
    },
    [catalog.mySurveys, draft, nav, toast],
  );

  const logout = useCallback(() => {
    session.signOut();
    void catalog.refreshMine("");
    if (nav.view === "mypage") nav.navigate("home");
    toast.show("로그아웃했어요.", "short");
  }, [catalog, nav, session, toast]);

  const inAppShell = appShellViews.has(nav.view);

  return (
    <div className="app-shell student-app">
      {nav.view === "landing" && (
        <LandingView
          onEnterSite={() => nav.enterApp("home")}
          surveys={catalog.publicSurveys}
          loadingSurveys={catalog.loadingPublic}
        />
      )}
      {inAppShell && (
        <WorkspaceSidebar
          open={sidebarOpen}
          view={nav.view}
          user={session.user}
          surveys={catalog.mySurveys}
          wallet={session.wallet}
          onNavigate={nav.navigate}
          onCreate={() => nav.navigate("create")}
          onOpenSurvey={openOwnedAnalytics}
          onAuth={requireAuth}
          onClose={() => setSidebarOpen(false)}
        />
      )}
      {inAppShell && (
        <Header
          view={nav.view}
          onNavigate={nav.navigate}
          onMenu={() => setSidebarOpen((open) => !open)}
          user={session.user}
          onAuth={requireAuth}
          onProfile={() => nav.navigate("mypage")}
          cashBalance={session.wallet.balance}
        />
      )}
      {nav.view === "home" && (
        <ProductHomeView
          surveys={catalog.publicSurveys}
          ownedSurveys={catalog.mySurveys}
          loadingSurveys={catalog.loadingPublic}
          user={session.user}
          authToken={session.authToken}
          cashBalance={session.wallet.balance}
          onAuth={requireAuth}
          onRefreshSurveys={() => void catalog.refreshPublic()}
          onCreate={(quickPrompt) => {
            if (quickPrompt) updatePrompt(quickPrompt);
            nav.navigate("create");
          }}
          onOpenBoard={() => nav.navigate("board")}
          onOpenSurvey={openSurvey}
          onOpenOwnedSurvey={openOwnedAnalytics}
          onOpenCommunity={() => nav.navigate("community")}
          onOpenPulseBoard={() => nav.navigate("pulses")}
        />
      )}
      {nav.view === "board" && (
        <SchoolBoardView
          surveys={catalog.publicSurveys}
          loadingSurveys={catalog.loadingPublic}
          onOpenSurvey={openSurvey}
          onCreate={() => nav.navigate("create")}
        />
      )}
      {nav.view === "pulses" && (
        <CampusPulseBoardView
          user={session.user}
          authToken={session.authToken}
          onAuth={requireAuth}
        />
      )}
      {nav.view === "community" && (
        <>
          <CommunityView
            user={session.user}
            authToken={session.authToken}
            onAuth={requireAuth}
            onCreateSurvey={() => nav.navigate("create")}
          />
          <Footer />
        </>
      )}
      {nav.view === "workspace" && (
        <WorkspaceView
          user={session.user}
          authToken={session.authToken}
          ownedSurveys={catalog.mySurveys}
          onAuth={requireAuth}
          onCreateSurvey={() => nav.navigate("create")}
          onOpenSurvey={(slug) => {
            const survey = catalog.mySurveys.find((item) => item.slug === slug);
            if (survey) openOwnedAnalytics(survey);
          }}
          onDuplicateSurvey={duplicateWorkspaceSurvey}
        />
      )}
      {nav.view === "workspace-review" && nav.workspaceReviewToken && (
        <WorkspaceReviewView
          token={nav.workspaceReviewToken}
          onBack={nav.exitWorkspaceReview}
        />
      )}
      {nav.view === "mypage" && session.user && (
        <MyPageView
          user={session.user}
          surveys={catalog.mySurveys}
          loading={catalog.loadingMine}
          error={catalog.mineError}
          onCreate={() => nav.navigate("create")}
          onOpenSurvey={openSurvey}
          onOpenAnalytics={openOwnedAnalytics}
          onOpenBoard={() => nav.navigate("board")}
          onDeleteSurvey={deleteOwnedSurvey}
          onLogout={logout}
          wallet={session.wallet}
        />
      )}
      {nav.view === "create" && (
        <CreateView
          prompt={draft.prompt}
          setPrompt={updatePrompt}
          references={draft.references}
          setReferences={updateReferences}
          surveyMode={draft.surveyMode}
          setSurveyMode={draft.setSurveyMode}
          targetGrade={draft.targetGrade}
          setTargetGrade={draft.setTargetGrade}
          questionCount={draft.questionCount}
          setQuestionCount={draft.setQuestionCount}
          onCreate={() => void startCreate()}
          onBack={() => nav.navigate("home")}
          onUseQuestions={(document) => {
            // 템플릿·빈 설문은 생성을 거치지 않습니다 — 편집기로 바로 갑니다.
            // loadFromSurvey 는 복제용이라 제목에 「복사본」을 붙이므로 쓰지 않습니다.
            draft.replaceDocument(document);
            nav.navigate("editor");
          }}
          isAnalyzing={generation.isGenerating}
        />
      )}
      {nav.view === "editor" && (
        <EditorView
          title={draft.title}
          setTitle={draft.setTitle}
          description={draft.description}
          setDescription={draft.setDescription}
          questions={draft.questions}
          setQuestions={draft.replaceQuestions}
          onBack={() => nav.navigate("create")}
          onPublish={() => {
            setInstagramStatus("");
            if (!session.isSignedIn) {
              publish.setPendingAfterAuth(true);
              requireAuth();
              return;
            }
            setPublishOpen(true);
          }}
          targetGrade={draft.targetGrade}
          onAiRevise={draft.reviseWithAi}
        />
      )}
      {nav.view === "published" && (
        <PublishedView
          title={draft.title}
          slug={publish.publishedSlug}
          listingRequested={publish.listingRequested}
          onSurvey={() => nav.navigate("survey")}
          onAnalytics={() => nav.navigate("analytics")}
          onHome={() => nav.navigate("home")}
          onBoard={() => nav.navigate("board")}
          initialInstagramStatus={instagramStatus}
        />
      )}
      {nav.view === "survey" && catalog.activeSurvey && (
        <SurveyView
          survey={catalog.activeSurvey}
          onBack={() => {
            if (initialSurvey) {
              window.location.assign("/?app=1");
              return;
            }
            nav.navigate("home");
          }}
          user={session.user}
          authToken={session.authToken}
          onAuth={requireAuth}
          onReward={() => void session.refreshWallet(session.authToken)}
        />
      )}
      {nav.view === "analytics" && (
        <RealAnalyticsView
          onHome={() => nav.navigate("home")}
          title={publish.publishedSlug ? draft.title : ""}
          slug={publish.publishedSlug}
          manageToken={publish.manageToken}
          questions={publish.publishedSlug ? draft.questions : []}
        />
      )}
      {publishOpen && (
        <PublishModal
          title={draft.title}
          onClose={() => setPublishOpen(false)}
          onConfirm={publishSurvey}
          onLogin={requireAuth}
          user={session.user}
          saving={publish.publishing}
          error={publish.error}
          cashBalance={session.wallet.balance}
          // 보상은 소요 시간으로 정해집니다 — 발행 화면에서 임의값을 쓰면
          // 실제 청구액과 어긋납니다.
          rewardCash={rewardCashForDuration(
            surveyEditing.estimatedMinutes(draft.questions),
          )}
        />
      )}
      {authOpen && (
        <AuthModal
          onClose={() => {
            setAuthOpen(false);
            publish.setPendingAfterAuth(false);
          }}
          onSuccess={(token, signedInUser) => {
            session.signIn(token, signedInUser);
            setAuthOpen(false);
            if (publish.pendingAfterAuth) {
              publish.setPendingAfterAuth(false);
              setPublishOpen(true);
            } else if (
              !publishOpen &&
              nav.view !== "survey" &&
              nav.view !== "community" &&
              nav.view !== "workspace"
            ) {
              nav.navigate("mypage");
            }
            toast.show(
              `${schoolLabel(signedInUser.schoolId)} 계정으로 로그인했어요.`,
            );
          }}
        />
      )}
      {generation.isGenerating && (
        <GenerationOverlay
          surveyMode={draft.surveyMode}
          questionCount={draft.questionCount}
          attachmentCount={
            draft.references.images.length +
            draft.references.files.length +
            draft.references.links.length
          }
          onCancel={() => {
            if (generation.cancel()) {
              toast.show("설문 생성을 취소했어요.", "long");
            }
          }}
        />
      )}
      {generation.clarification && !generation.isGenerating && (
        <ClarificationModal
          state={generation.clarification}
          onClose={() => {
            generation.dismissClarification();
            window.setTimeout(
              () => document.getElementById("survey-maker")?.focus(),
              80,
            );
          }}
          onChoose={(option) => {
            const nextPrompt = generation.answerClarification(option);
            if (nextPrompt) draft.setPrompt(nextPrompt);
          }}
        />
      )}
      {toast.message && (
        <div className="toast" role="status">
          <CircleHelp size={17} />
          {toast.message}
        </div>
      )}
    </div>
  );
}
