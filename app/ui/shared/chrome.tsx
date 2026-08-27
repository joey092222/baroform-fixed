"use client";

import {
  BarChart3,
  Coins,
  FileText,
  LogIn,
  Menu,
  Plus,
  School,
  UserRound,
  UsersRound,
  WandSparkles,
  X,
} from "lucide-react";
import { schoolLabel } from "../../survey-board";
import type { AppView as View } from "../../ux/navigation";
import type { AuthUser, OwnedSurvey, WalletData } from "../../ux/types";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className={compact ? "brand-mark compact" : "brand-mark"} aria-hidden>
      <span />
      <span />
    </span>
  );
}

export function Header({
  view,
  onNavigate,
  onMenu,
  user,
  onAuth,
  onProfile,
  cashBalance,
}: {
  view: View;
  onNavigate: (view: View) => void;
  onMenu: () => void;
  user: AuthUser | null;
  onAuth: () => void;
  onProfile: () => void;
  cashBalance: number;
}) {
  return (
    <>
      <header className="site-header">
        <div className="header-inner">
        <button
          className="workspace-menu-trigger"
          type="button"
          onClick={onMenu}
          aria-label="작업 메뉴 열기"
        >
          <Menu size={19} />
          <span>메뉴</span>
        </button>
        <button
          className="brand"
          type="button"
          onClick={() => onNavigate("home")}
          aria-label="바로폼 홈"
        >
          <BrandMark />
          <strong>바로폼</strong>
        </button>
        <nav className="main-nav" aria-label="주요 메뉴">
          {/* 이 헤더에서 채워진 버튼은 이것 하나입니다 — 축소 불가능한 행동이
              무엇인지가 시각적으로 유일해야 합니다. */}
          <button
            type="button"
            className="nav-make"
            aria-current={view === "create" ? "page" : undefined}
            onClick={() => onNavigate("create")}
          >
            <Plus size={16} />
            설문 만들기
          </button>
          <button
            type="button"
            className={view === "board" ? "active" : ""}
            aria-current={view === "board" ? "page" : undefined}
            onClick={() => onNavigate("board")}
          >
            전체 설문
          </button>
          <button
            type="button"
            className={view === "pulses" ? "active" : ""}
            aria-current={view === "pulses" ? "page" : undefined}
            onClick={() => onNavigate("pulses")}
          >
            캠퍼스의 생각
          </button>
          <button
            type="button"
            className={view === "community" ? "active" : ""}
            aria-current={view === "community" ? "page" : undefined}
            onClick={() => onNavigate("community")}
          >
            커뮤니티
          </button>
          <button
            type="button"
            className={view === "workspace" ? "active" : ""}
            aria-current={view === "workspace" ? "page" : undefined}
            onClick={() => onNavigate("workspace")}
          >
            협업
          </button>
          {user && (
            <button
              type="button"
              className={view === "mypage" ? "active" : ""}
              aria-current={view === "mypage" ? "page" : undefined}
              onClick={onProfile}
            >
              내 설문
            </button>
          )}
        </nav>
        <div className="header-actions">
          {user ? (
            <>
              <span className="member-school">
                <School size={14} />
                {schoolLabel(user.schoolId)}
              </span>
              <button className="cash-chip" type="button" onClick={onProfile}>
                <Coins size={14} />
                {cashBalance.toLocaleString("ko-KR")}C
              </button>
            </>
          ) : null}
          <button
            className={`auth-button ${view === "mypage" ? "active" : ""}`}
            type="button"
            onClick={user ? onProfile : onAuth}
            aria-current={view === "mypage" ? "page" : undefined}
          >
            {user ? <UserRound size={15} /> : <LogIn size={15} />}
            {user ? user.name : "로그인"}
          </button>
        </div>
        </div>
      </header>
      <nav className="mobile-tabbar" aria-label="모바일 주요 메뉴">
        <button
          type="button"
          className={view === "home" ? "active" : ""}
          aria-current={view === "home" ? "page" : undefined}
          onClick={() => onNavigate("home")}
        >
          <WandSparkles size={20} />
          <span>홈</span>
        </button>
        <button
          type="button"
          className={view === "board" ? "active" : ""}
          aria-current={view === "board" ? "page" : undefined}
          onClick={() => onNavigate("board")}
        >
          <School size={20} />
          <span>설문</span>
        </button>
        <button
          type="button"
          className="mobile-tabbar-create"
          onClick={() => onNavigate("create")}
        >
          <span className="mobile-tabbar-create-icon">
            <Plus size={22} />
          </span>
          <span>만들기</span>
        </button>
        <button
          type="button"
          className={view === "pulses" ? "active" : ""}
          aria-current={view === "pulses" ? "page" : undefined}
          onClick={() => onNavigate("pulses")}
        >
          <BarChart3 size={20} />
          <span>투표</span>
        </button>
        <button
          type="button"
          className={view === "mypage" ? "active" : ""}
          aria-current={view === "mypage" ? "page" : undefined}
          onClick={user ? onProfile : onAuth}
        >
          <UserRound size={20} />
          <span>내 정보</span>
        </button>
      </nav>
    </>
  );
}

export function WorkspaceSidebar({
  open,
  view,
  user,
  surveys,
  wallet,
  onNavigate,
  onCreate,
  onOpenSurvey,
  onAuth,
  onClose,
}: {
  open: boolean;
  view: View;
  user: AuthUser | null;
  surveys: OwnedSurvey[];
  wallet: WalletData;
  onNavigate: (view: View) => void;
  onCreate: () => void;
  onOpenSurvey: (survey: OwnedSurvey) => void;
  onAuth: () => void;
  onClose: () => void;
}) {
  const go = (nextView: View) => {
    onNavigate(nextView);
    onClose();
  };

  const openProfile = () => {
    if (user) go("mypage");
    else onAuth();
    onClose();
  };

  return (
    <>
      <button
        type="button"
        className={`workspace-sidebar-backdrop ${open ? "open" : ""}`}
        onClick={onClose}
        aria-label="작업 메뉴 닫기"
        tabIndex={open ? 0 : -1}
      />
      <aside
        className={`workspace-sidebar ${open ? "open" : ""}`}
        aria-label="바로폼 작업 메뉴"
        aria-hidden={!open}
      >
        <div className="workspace-sidebar-head">
          <button
            type="button"
            className="workspace-brand"
            onClick={() => go("home")}
            aria-label="바로폼 홈"
          >
            <BrandMark />
            <span>
              <strong>바로폼</strong>
              <small>대학생 설문 공간</small>
            </span>
          </button>
          <button
            type="button"
            className="workspace-sidebar-close"
            onClick={onClose}
            aria-label="작업 메뉴 닫기"
          >
            <X size={18} />
          </button>
        </div>

        <button
          type="button"
          className={`workspace-create ${view === "create" ? "active" : ""}`}
          onClick={() => {
            onCreate();
            onClose();
          }}
        >
          <Plus size={18} />
          새 설문 만들기
        </button>

        <nav className="workspace-nav" aria-label="서비스 메뉴">
          <button
            type="button"
            className={view === "home" ? "active" : ""}
            onClick={() => go("home")}
          >
            <WandSparkles size={17} />
            홈
          </button>
          <button
            type="button"
            className={view === "board" ? "active" : ""}
            onClick={() => go("board")}
          >
            <School size={17} />
            설문 찾기
          </button>
          <button
            type="button"
            className={view === "pulses" ? "active" : ""}
            onClick={() => go("pulses")}
          >
            <BarChart3 size={17} />
            캠퍼스의 생각
          </button>
          <button
            type="button"
            className={view === "community" ? "active" : ""}
            onClick={() => go("community")}
          >
            <UsersRound size={17} />
            커뮤니티
          </button>
          <button
            type="button"
            className={view === "workspace" ? "active" : ""}
            onClick={() => go("workspace")}
          >
            <UsersRound size={17} />
            협업 워크스페이스
          </button>
          <button
            type="button"
            className={view === "mypage" ? "active" : ""}
            onClick={openProfile}
          >
            <UserRound size={17} />
            마이페이지
          </button>
        </nav>

        <section className="workspace-history" aria-labelledby="recent-surveys-title">
          <div className="workspace-section-heading">
            <span id="recent-surveys-title">최근 만든 설문</span>
          </div>
          {user && surveys.length > 0 ? (
            <div className="workspace-recent-list">
              {surveys.slice(0, 2).map((survey) => (
                <button
                  type="button"
                  key={survey.slug}
                  onClick={() => {
                    onOpenSurvey(survey);
                    onClose();
                  }}
                  title={survey.title}
                >
                  <FileText size={15} />
                  <span>
                    <strong>{survey.title}</strong>
                    <small>응답 {survey.responseCount}개</small>
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <button
              type="button"
              className="workspace-empty-history"
              onClick={() => {
                if (user) onCreate();
                else onAuth();
                onClose();
              }}
            >
              {user ? "아직 만든 설문이 없어요" : "로그인하면 내 설문을 볼 수 있어요"}
            </button>
          )}
        </section>

        <button type="button" className="workspace-profile" onClick={openProfile}>
          <span className="workspace-avatar">{user?.name.slice(0, 1) ?? "바"}</span>
          <span>
            <strong>{user?.name ?? "로그인"}</strong>
            <small>{user ? schoolLabel(user.schoolId) : "내 기록 확인하기"}</small>
          </span>
          <span className="workspace-profile-cash">
            <Coins size={14} />
            {wallet.balance.toLocaleString("ko-KR")}C
          </span>
        </button>
      </aside>
    </>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div>
        <span className="footer-brand">
          <BrandMark compact />
          <strong>바로폼</strong>
        </span>
        <p>학교의 생각을 가장 빠르게 만나는 곳.</p>
      </div>
      <span>© 2026 BAROFORM</span>
    </footer>
  );
}
