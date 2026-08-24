import { writeFileSync } from "node:fs";
import { CSS, navbar, guestSidebar, rightRail, surveyCard, page } from "./_components.mjs";

const cards = [
  { seed: "library", cat: "교내 시설", big: "도서관<br>좌석 예약제", cash: 30, q: "지금 예약 방식, 바꿔야 할까요?", au: "경영대 프로젝트팀 · 연세대 신촌", n: 12, min: 3, done: 24, goal: 100, dday: "D-6", hot: "전학년" },
  { seed: "cafe2", cat: "제품 반응", big: "신메뉴<br>가격 민감도", cash: 50, q: "얼마까지 낼 수 있나요?", au: "캠퍼스 F&B 스타트업 · 기업 조사", n: 9, min: 4, done: 318, goal: 400, dday: "D-2", hot: "20대" },
  { seed: "intern", cat: "진로 · 취업", big: "인턴<br>준비 기간", cash: 50, q: "실제로 몇 개월 걸렸나요?", au: "진로 학회 · 연세대 신촌", n: 15, min: 5, done: 96, goal: 300, dday: "D-11", hot: "3·4학년" },
  { seed: "phone", cat: "생활 · 소비", big: "카카오톡<br>인스타 이용", cash: 50, q: "하루에 얼마나 쓰고 있나요?", au: "미디어 수업 조별과제 · 연세대", n: 7, min: 4, done: 41, goal: 120, dday: "D-4", hot: "전학년" },
  { seed: "parttime", cat: "수업 · 과제", big: "아르바이트<br>시급 만족도", cash: 30, q: "지금 시급, 만족하시나요?", au: "노동경제 수업 · 연세대 신촌", n: 10, min: 4, done: 12, goal: 150, dday: "D-9", hot: "전학년" },
  { seed: "drive", cat: "학회 · 연구", big: "운전면허<br>초시 합격률", cash: 50, q: "몇 번 만에 붙었나요?", au: "통계 학회 · 연세대 신촌", n: 7, min: 4, done: 42, goal: 100, dday: "D-3", hot: "전학년" },
];
const W = (n, b) => writeFileSync(n, b);
const lockNote = `<div style="max-width:1180px;margin:12px auto 0;padding:0 24px"><span class="badge-preview">🔒 로그인 후 볼 수 있는 화면의 미리보기</span></div>`;

// ── 00 index ─────────────────────────────────────────────
const idx = (h, d, items) => `<div style="margin-bottom:26px">
  <div style="font-size:16px;font-weight:850;margin-bottom:4px">${h}</div>
  <div style="font-size:13px;color:var(--muted);margin-bottom:12px">${d}</div>
  <div class="grid3">${items.map(([f, t, s]) => `
    <a class="panel pad" href="${f}" style="display:block">
      <div style="font-size:15px;font-weight:800;margin-bottom:5px">${t}</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.55">${s}</div>
      <div style="font-size:12.5px;color:var(--blue);font-weight:800;margin-top:10px">열어보기 →</div></a>`).join("")}
  </div></div>`;
W("index.html", page("전체 화면", "목차", `
<div class="layout one" style="max-width:1100px">
  <main style="padding-top:14px">
    <div style="margin-bottom:24px"><div class="h1">바로폼 리디자인 프리뷰</div>
      <div class="sub">모든 화면이 링크로 이어져 있어 실제 사이트처럼 눌러볼 수 있습니다. 비로그인 기준이고, 데이터는 전부 예시입니다.</div></div>
    ${idx("공개 화면", "누구나 보는 화면", [
      ["01-landing.html", "① 랜딩", "데모 영상 + 시작 버튼"],
      ["02-feed.html", "② 참여하기 (메인)", "설문 카드 그리드 + 인기글 + 투표"],
      ["03-pulses.html", "③ 캠퍼스 투표", "10초 투표 카드"],
      ["04-community.html", "④ 커뮤니티", "게시판 리스트"],
      ["07-login.html", "⑦ 로그인", "학교 이메일 모달"],
      ["12-respond.html", "⑫ 설문 응답", "한 문항씩 · 진행바 · 캐시"],
    ])}
    ${idx("설문 제작 흐름", "만들기 → 편집 → 게시", [
      ["08-create.html", "⑧ 제작 진입", "AI vs 템플릿, 확실히 분리"],
      ["09-ai-prompt.html", "⑨ AI 프롬프트", "첨부 · 제작 방식 · 대상 · 문항 수"],
      ["10-editor.html", "⑩ 편집기", "3패널 편집 + AI 수정"],
      ["15-templates.html", "⑮ 템플릿", "실제 템플릿 28종 · 블록 구성 열람"],
      ["11-published.html", "⑪ 게시 완료", "링크 복사 + 공유"],
    ])}
    ${idx("내 활동 · 결과", "로그인 후 화면 (미리보기)", [
      ["05-workspace.html", "⑤ 협업", "팀 워크스페이스 (게이트)"],
      ["06-mypage.html", "⑥ 마이페이지", "내 설문 · 캐시 (게이트)"],
      ["13-results-overview.html", "⑬ 결과 · 개요", "제출 구성 + 핵심 발견"],
      ["14-results-questions.html", "⑭ 결과 · 문항별", "세로 막대 차트"],
    ])}
  </main>
</div>`));

// ── 01 랜딩 (+데모 영상) ─────────────────────────────────
W("01-landing.html", page("랜딩", "① 랜딩", `
<div style="position:relative;height:100vh;min-height:600px;overflow:hidden">
  <video src="demo.mp4" autoplay muted loop playsinline
    style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover"></video>
  <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,14,28,.58) 0%,rgba(8,14,28,.3) 42%,rgba(8,14,28,.7) 100%)"></div>
  ${navbar("", { overlay: true })}
  <div style="position:relative;z-index:2;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:0 24px;color:#fff">
    <div style="display:inline-flex;height:33px;align-items:center;padding:0 16px;border-radius:999px;background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.3);backdrop-filter:blur(8px);font-size:13.5px;font-weight:750;margin-bottom:22px">대학생의 질문이 실제 응답이 되는 곳</div>
    <h1 style="font-size:60px;font-weight:900;letter-spacing:-.045em;line-height:1.16;text-shadow:0 6px 30px rgba(0,0,0,.5)">학생들의 질문과 답을<br>한곳에서.</h1>
    <p style="margin-top:20px;font-size:18px;color:rgba(255,255,255,.88);line-height:1.62;text-shadow:0 2px 14px rgba(0,0,0,.45)">AI가 문항을 설계하고, 우리 학교 학생들이 응답합니다.<br>응답할 때마다 캐시가 쌓여요.</p>
    <div style="display:flex;gap:12px;margin-top:32px">
      <a class="cta big" href="08-create.html" style="background:#fff;color:var(--navy);box-shadow:0 12px 38px rgba(0,0,0,.34)">무료로 시작하기 →</a>
      <a class="cta big" href="02-feed.html" style="background:rgba(255,255,255,.13);border:1.5px solid rgba(255,255,255,.5);backdrop-filter:blur(8px)">설문 둘러보기</a></div>
    <div style="display:flex;gap:46px;margin-top:48px">
      <div><b style="font-size:24px;letter-spacing:-.02em">12,438</b><div style="font-size:12.5px;color:rgba(255,255,255,.72)">누적 응답</div></div>
      <div><b style="font-size:24px">8개교</b><div style="font-size:12.5px;color:rgba(255,255,255,.72)">참여 대학</div></div>
      <div><b style="font-size:24px">91%</b><div style="font-size:12.5px;color:rgba(255,255,255,.72)">평균 완료율</div></div></div>
  </div>
  <div style="position:absolute;z-index:2;left:0;right:0;bottom:16px;display:flex;justify-content:center;color:rgba(255,255,255,.7);font-size:12px;font-weight:650">▼ 지금 캠퍼스에서 돌고 있는 설문</div>
</div>
<div style="max-width:1180px;margin:34px auto 46px;padding:0 24px">
  <div style="display:flex;align-items:baseline;justify-content:space-between;margin-bottom:14px">
    <div style="font-size:17px;font-weight:850;letter-spacing:-.02em">지금 캠퍼스에서 돌고 있는 설문</div>
    <a href="index.html" style="font-size:12.5px;color:var(--muted);font-weight:650">전체 화면 목차 ↗</a></div>
  <div class="grid3">${cards.slice(0, 3).map(surveyCard).join("")}</div>
</div>`, { bare: true }));

// ── 02 참여하기 (비로그인) ───────────────────────────────
W("02-feed.html", page("참여하기", "② 참여하기", `
${navbar("참여하기")}
<div class="layout">
  ${guestSidebar()}
  <main>
    <div class="tabs"><a class="on">진행중인 설문 <small>142</small></a><a>종료된 설문 <small>1,038</small></a></div>
    <div class="search">🔍 설문 제목·주제 검색</div>
    <div class="sort"><a class="on">최신순</a><a>마감 임박</a><a>캐시 높은순</a><a>이번 주 인기</a></div>
    <div class="grid3">${cards.map(surveyCard).join("")}</div>
  </main>
  ${rightRail()}
</div>`));

// ── 03 캠퍼스 투표 ───────────────────────────────────────
// C안: VS 대결형 — 찬성 파랑 / 반대 주황, 이긴 쪽만 채도를 살린다
// 남색 단색: 이긴 쪽은 솔리드, 진 쪽은 같은 색의 옅은 톤 — 색이 아니라 명도로 겨룬다
const VS_NAVY = { solid: "linear-gradient(158deg,#33578f,#1a3763)", tint: "#eef1f7", line: "#d3dced", ink: "#1c3a6b" };
const VS_A = VS_NAVY;
const VS_B = VS_NAVY;
const vsSide = (label, p, win, c) => `<div style="flex:1;position:relative;height:116px;border-radius:12px;overflow:hidden;
  background:${win ? c.solid : c.tint};border:1px solid ${win ? "transparent" : c.line};
  box-shadow:${win ? "0 6px 16px rgba(20,40,80,.16)" : "none"}">
  <div style="height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px">
    <b style="font-size:30px;letter-spacing:-.04em;line-height:1;color:${win ? "#fff" : c.ink}">${p}<span style="font-size:16px;font-weight:800">%</span></b>
    <span style="font-size:12.5px;font-weight:750;color:${win ? "rgba(255,255,255,.92)" : c.ink}">${label}</span></div>
  <div style="position:absolute;left:12px;right:12px;bottom:11px;height:4px;border-radius:2px;background:${win ? "rgba(255,255,255,.3)" : "#fff"}">
    <i style="display:block;height:100%;width:${p}%;border-radius:2px;background:${win ? "#fff" : "#aebbd2"}"></i></div></div>`;

const pollCard = (q, a, ap, b, bp, n, tag) => `<div class="panel pad">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
    <span class="chip c">${tag}</span><span style="font-size:12px;color:var(--muted)">${n}명 참여</span></div>
  <h4 style="font-size:16.5px;font-weight:800;letter-spacing:-.02em;line-height:1.4;margin-bottom:14px">${q}</h4>
  <div style="display:flex;align-items:center;gap:10px">
    ${vsSide(a, ap, ap >= bp, VS_A)}
    <span style="font-size:11px;font-weight:900;color:#b3bac4;letter-spacing:.06em">VS</span>
    ${vsSide(b, bp, bp > ap, VS_B)}</div>
  <a class="btn" style="margin-top:12px">투표하기</a></div>`;
W("03-pulses.html", page("캠퍼스 투표", "③ 캠퍼스 투표", `
${navbar("캠퍼스 투표")}
<div class="layout">
  ${guestSidebar()}
  <main>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div><div class="h1">오늘 캠퍼스의 생각</div><div class="sub">10초 투표로 학교 여론을 확인하세요. 투표는 로그인 없이 가능해요.</div></div>
      <a class="cta" href="07-login.html">+ 새 투표 열기</a></div>
    <div class="grid2">
      ${pollCard("이번 학기 셔틀 증차, 필요할까요?", "필요하다", 68, "지금이면 충분", 32, "1,204", "오늘 마감")}
      ${pollCard("중간고사 기간 도서관 24시간 개방?", "찬성", 81, "반대", 19, "864", "D-2")}
      ${pollCard("학식 가격 500원 인상 + 반찬 추가?", "그대로가 낫다", 55, "인상 찬성", 45, "512", "D-5")}
      ${pollCard("축제 라인업, 힙합 vs 밴드?", "힙합", 47, "밴드", 53, "2,031", "인기")}
    </div>
  </main>
  ${rightRail()}
</div>`));

// ── 04 커뮤니티 ─────────────────────────────────────────
const row = (cat, t, s, m) => `<div style="display:flex;gap:13px;align-items:center;padding:14px 16px;border-top:1px solid var(--line)">
  <span class="chip o" style="flex:0 0 auto">${cat}</span>
  <div style="flex:1;min-width:0"><div style="font-size:15px;font-weight:700">${t}</div>
  <div style="font-size:12.5px;color:var(--muted);margin-top:3px">${s}</div></div>
  <span style="font-size:12px;color:var(--muted);flex:0 0 auto">${m}</span></div>`;
W("04-community.html", page("커뮤니티", "④ 커뮤니티", `
${navbar("커뮤니티")}
<div class="layout">
  ${guestSidebar()}
  <main>
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:16px">
      <div><div class="h1">커뮤니티</div><div class="sub">설문 만드는 사람들의 이야기 · 글쓰기는 로그인 후 가능해요</div></div>
      <a class="cta" href="07-login.html">+ 글쓰기</a></div>
    <div class="tabs" style="margin-bottom:0"><a class="on">전체</a><a>운영 팁</a><a>설계 질문</a><a>자료실</a><a>자유게시판</a></div>
    <div class="panel" style="border-top:0;border-radius:0 0 12px 12px">
      ${row("운영 팁", "응답자 100명 모으는 데 얼마 들었나 정리해봄", "캐시 총 5,000C 썼고 에타 홍보가 제일 효율 좋았음…", "조회 366 · 댓글 18 · 10분 전")}
      ${row("설계 질문", "객관식만 쓰면 안 되는 이유", "주관식 하나를 꼭 넣어야 하는 이유를 데이터로 보여드림", "조회 254 · 댓글 27 · 1시간 전")}
      ${row("자료실", "IRB 통과한 문항 공유합니다", "심리학과 졸업논문용으로 승인받은 문항 세트입니다", "조회 141 · 댓글 9 · 3시간 전")}
      ${row("자유게시판", "설문 문항 200개짜리 돌려본 후기", "완료율 4%… 다들 이러지 마세요", "조회 979 · 댓글 43 · 어제")}
      ${row("설계 질문", "리커트 5점 vs 7점, 뭐 쓰세요?", "분석 편의는 5점인데 민감도는 7점이 좋고…", "조회 238 · 댓글 52 · 어제")}
    </div>
  </main>
  ${rightRail()}
</div>`));

// ── 05 협업 (비로그인 게이트 + 흐린 미리보기) ────────────
W("05-workspace.html", page("협업", "⑤ 협업", `
${navbar("")}
<div style="position:relative">
  <div style="filter:blur(4px);opacity:.55;pointer-events:none">
    <div class="layout two">
      ${guestSidebar()}
      <main><div class="h1" style="margin-bottom:14px">팀 워크스페이스</div>
        <div class="grid2">
          <div class="panel pad" style="height:210px"></div><div class="panel pad" style="height:210px"></div></div></main>
    </div>
  </div>
  <div style="position:absolute;inset:0;display:grid;place-items:center">
    <div class="panel" style="width:430px;padding:32px;text-align:center;box-shadow:0 24px 70px rgba(15,30,60,.18)">
      <div style="font-size:28px;margin-bottom:10px">👥</div>
      <div style="font-size:20px;font-weight:850;letter-spacing:-.025em;margin-bottom:7px">설문을 팀과 함께 완성하세요</div>
      <div style="font-size:13.5px;color:var(--muted);line-height:1.65;margin-bottom:18px">문항별 담당 배정 · 댓글 검토 · 교수님 검토 링크<br>로그인하면 바로 시작할 수 있어요.</div>
      <a class="cta big" style="width:100%;justify-content:center" href="07-login.html">로그인하고 협업 시작 →</a>
    </div>
  </div>
</div>`));

// ── 06 마이페이지 (비로그인 게이트) ──────────────────────
W("06-mypage.html", page("마이페이지", "⑥ 마이페이지", `
${navbar("")}
<div style="position:relative">
  <div style="filter:blur(4px);opacity:.55;pointer-events:none">
    <div class="layout one" style="max-width:1180px"><main>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:15px">
        <div class="panel pad" style="height:86px"></div><div class="panel pad" style="height:86px"></div>
        <div class="panel pad" style="height:86px"></div><div class="panel pad" style="height:86px"></div></div>
      <div class="panel" style="height:240px"></div></main></div>
  </div>
  <div style="position:absolute;inset:0;display:grid;place-items:center">
    <div class="panel" style="width:430px;padding:32px;text-align:center;box-shadow:0 24px 70px rgba(15,30,60,.18)">
      <div style="font-size:28px;margin-bottom:10px">💳</div>
      <div style="font-size:20px;font-weight:850;letter-spacing:-.025em;margin-bottom:7px">내 설문과 캐시는 로그인 후에</div>
      <div style="font-size:13.5px;color:var(--muted);line-height:1.65;margin-bottom:18px">만든 설문의 응답 현황, 적립한 캐시,<br>응답 내역을 한곳에서 볼 수 있어요.</div>
      <a class="cta big" style="width:100%;justify-content:center" href="07-login.html">학교 이메일로 로그인 →</a>
    </div>
  </div>
</div>`));

// ── 07 로그인 ────────────────────────────────────────────
W("07-login.html", page("로그인", "⑦ 로그인", `
<div style="filter:blur(3px);opacity:.5;pointer-events:none">${navbar("참여하기")}
<div class="layout">${guestSidebar()}<main><div class="grid3">${cards.slice(0, 3).map(surveyCard).join("")}</div></main>${rightRail()}</div></div>
<div style="position:fixed;inset:0;background:rgba(15,23,38,.45);display:grid;place-items:center">
  <div class="panel" style="width:400px;padding:32px;border-radius:16px;box-shadow:0 30px 80px rgba(0,0,0,.25)">
    <div class="brand" style="justify-content:center;margin-bottom:8px"><span class="bmark"><i></i><i></i></span>바로폼</div>
    <p style="text-align:center;font-size:13.5px;color:var(--muted);margin-bottom:22px">학교 이메일로 시작하면 우리 학교 설문이 먼저 보여요.</p>
    <div style="font-size:12.5px;font-weight:750;margin-bottom:6px">학교 이메일</div>
    <div class="search" style="margin-bottom:10px;color:#b8bec8">name@yonsei.ac.kr</div>
    <div style="font-size:12.5px;font-weight:750;margin-bottom:6px">비밀번호</div>
    <div class="search" style="margin-bottom:18px;color:#b8bec8">••••••••</div>
    <a class="cta big" style="width:100%;justify-content:center" href="02-feed.html">로그인</a>
    <div style="display:flex;justify-content:space-between;margin-top:14px;font-size:12.5px;color:var(--muted)">
      <a>비밀번호 찾기</a><a style="color:var(--blue);font-weight:750">회원가입 →</a></div>
  </div>
</div>`));

// ── 08 제작 진입: AI와 템플릿을 확실히 분리 ──────────────
const tpl = (t, s, tags) => `<div class="panel pad" style="cursor:pointer;background:#fff">
  <div style="font-size:14.5px;font-weight:800;margin-bottom:5px">${t}</div>
  <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-bottom:9px">${s}</div>
  <div class="chiprow" style="margin:0">${tags.map(x => `<span class="chip o">${x}</span>`).join("")}</div></div>`;
W("08-create.html", page("제작 진입", "⑧ 제작 진입", `
${navbar("")}
<div class="layout one" style="max-width:1120px">
  <main>
    <div style="text-align:center;margin:24px 0 28px"><div class="h1">새 설문을 어떻게 만들까요?</div>
      <div class="sub">두 방법 모두 같은 편집기로 이어져요. 익숙한 쪽으로 시작하세요.</div></div>
    <div style="display:grid;grid-template-columns:1fr 56px 1fr;align-items:stretch">
      <a class="panel" href="09-ai-prompt.html" style="display:flex;flex-direction:column;padding:30px;background:#fff">
        <div style="width:44px;height:44px;border-radius:12px;background:#e9eff9;display:grid;place-items:center;font-size:21px;margin-bottom:15px">✦</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-.035em;margin-bottom:8px">AI 자동 생성</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.65;margin-bottom:18px">조사하고 싶은 내용을 <b style="color:var(--text)">한 문장</b>으로 쓰면<br>문항·선택지·순서까지 AI가 설계해요.</div>
        <ul style="list-style:none;font-size:13px;color:#4a515c;line-height:2;margin-bottom:22px">
          <li><span style="color:var(--navy);font-weight:850">✓</span> 사진·파일·링크를 참고 자료로 첨부</li>
          <li><span style="color:var(--navy);font-weight:850">✓</span> 일반 설문 / 정밀·연구 설문 선택</li>
          <li><span style="color:var(--navy);font-weight:850">✓</span> 생성 후 자유롭게 수정</li></ul>
        <span class="cta big" style="width:100%;justify-content:center;margin-top:auto">한 문장으로 시작 →</span>
      </a>
      <div style="display:grid;place-items:center"><span style="width:36px;height:36px;border-radius:50%;background:#fff;border:1px solid var(--line);display:grid;place-items:center;font-size:11.5px;font-weight:800;color:var(--muted)">또는</span></div>
      <a class="panel" href="15-templates.html" style="display:flex;flex-direction:column;padding:30px;background:#fff">
        <div style="width:44px;height:44px;border-radius:12px;background:#eef1f5;display:grid;place-items:center;font-size:21px;margin-bottom:15px">📋</div>
        <div style="font-size:22px;font-weight:900;letter-spacing:-.035em;margin-bottom:8px">템플릿으로 시작</div>
        <div style="font-size:14px;color:var(--muted);line-height:1.65;margin-bottom:18px">검증된 설문 구조를 골라<br><b style="color:var(--text)">문항만 다듬어</b> 바로 배포해요.</div>
        <ul style="list-style:none;font-size:13px;color:#4a515c;line-height:2;margin-bottom:22px">
          <li><span style="color:var(--navy);font-weight:850">✓</span> 대학가 설문 318건 분석, 템플릿 28종</li>
          <li><span style="color:var(--navy);font-weight:850">✓</span> 문구만 바꿔 바로 배포</li>
          <li><span style="color:var(--navy);font-weight:850">✓</span> 편집기에서 문항 추가·삭제</li></ul>
        <span class="cta big" style="width:100%;justify-content:center;margin-top:auto">템플릿 고르기 →</span>
      </a>
    </div>
  </main>
</div>`));

W("09-ai-prompt.html", page("AI 프롬프트", "⑨ AI 프롬프트", `
${navbar("")}
<div class="layout one" style="max-width:1180px;padding-left:16px;padding-right:16px">
  <main style="padding-top:64px">
    <div style="text-align:center;margin-bottom:40px">
      <span style="display:inline-flex;height:28px;align-items:center;padding:0 13px;border-radius:999px;background:var(--blue-bg);color:var(--blue);font-size:13px;font-weight:800;margin-bottom:18px">설문 초안 만들기</span>
      <div style="font-size:54px;font-weight:900;letter-spacing:-.05em;line-height:1.15">어떤 설문을 만들까요?</div>
      <div style="color:var(--muted);font-size:16px;margin-top:14px">내용을 적거나 참고할 사진·파일·링크를 추가해주세요.</div></div>
    <div class="panel" style="padding:22px">
      <div style="min-height:110px;font-size:16.5px;line-height:1.6">대학생의 아르바이트 경험과 시급 만족도를 조사하고 싶어요. 전공별 차이도 보고 싶습니다<span style="border-left:2px solid var(--blue)">&nbsp;</span></div>
      <div style="display:flex;align-items:center;gap:8px;border-top:1px solid var(--line);padding-top:13px;margin-bottom:16px">
        <a class="btn sm" style="height:34px">🖼 사진 첨부</a>
        <a class="btn sm" style="height:34px">📄 파일 첨부</a>
        <a class="btn sm" style="height:34px">🔗 링크 추가</a>
        <span style="margin-left:auto;font-size:12px;color:var(--muted)">사진 10장 · 파일 10MB/개 · 전체 20MB</span></div>
      <div style="border:1px solid var(--line);border-radius:11px;padding:15px;margin-bottom:16px">
        <div style="font-size:12.5px;font-weight:800;color:var(--muted);margin-bottom:10px">설문 제작 방식</div>
        <div class="grid2">
          <div style="display:flex;gap:10px;padding:13px 14px;border:2px solid var(--blue);border-radius:10px;background:var(--blue-bg)">
            <span style="width:17px;height:17px;border-radius:50%;border:5px solid var(--blue);background:#fff;flex:0 0 auto;margin-top:2px"></span>
            <div><b style="font-size:14px">일반 설문 <span class="chip c" style="height:20px;font-size:10.5px;margin-left:4px">추천</span></b>
              <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-top:4px">수업 과제, 만족도, 이용 현황처럼 빠르고 자연스러운 설문이 필요할 때</div></div></div>
          <div style="display:flex;gap:10px;padding:13px 14px;border:1px solid var(--line);border-radius:10px">
            <span style="width:17px;height:17px;border-radius:50%;border:2px solid var(--line-dk);flex:0 0 auto;margin-top:2px"></span>
            <div><b style="font-size:14px">정밀·연구 설문</b>
              <div style="font-size:12px;color:var(--muted);line-height:1.5;margin-top:4px">논문, 가설 검증, 복잡한 분기처럼 정교한 설문이 필요할 때</div></div></div>
        </div>
        <div style="font-size:11.5px;color:var(--muted);margin-top:9px">두 방식 모두 관련 정보를 확인하고 문항 품질을 검토해요.</div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <span style="font-size:12.5px;color:var(--muted)">✨ 조사 의도를 읽고 문항을 구성해요 · 약 30초</span>
        <span style="display:flex;align-items:center;gap:12px"><span style="font-size:12px;color:var(--muted)">54/300</span>
          <a class="cta" href="10-editor.html">✨ AI로 설문 만들기 →</a></span></div>
    </div>
    <div class="grid2" style="grid-template-columns:1.6fr 1fr;margin-top:14px">
      <div class="panel pad">
        <div style="display:flex;justify-content:space-between;margin-bottom:11px">
          <b style="font-size:13.5px">👥 응답 대상</b><span style="font-size:11.5px;color:var(--muted)">학년을 선택해주세요</span></div>
        <div style="display:flex;gap:7px;flex-wrap:wrap">
          ${["1학년", "2학년", "3학년", "4학년", "1·2학년", "3·4학년"].map(g => `<span class="chip o" style="height:32px;padding:0 14px;border-radius:999px">${g}</span>`).join("")}
          <span class="chip" style="height:32px;padding:0 14px;border-radius:999px;background:var(--navy);color:#fff">전학년</span></div></div>
      <div class="panel pad">
        <div style="display:flex;justify-content:space-between;margin-bottom:11px">
          <b style="font-size:13.5px">📊 문항 수</b><span style="font-size:11.5px;color:var(--muted)">1~30개</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <a class="btn sm" style="width:38px;height:38px;font-size:17px">−</a>
          <div style="flex:1;height:38px;border:1px solid var(--line);border-radius:8px;display:grid;place-items:center;font-size:15px;font-weight:800">7 개</div>
          <a class="btn sm" style="width:38px;height:38px;font-size:17px">+</a></div></div>
    </div>
  </main>
</div>`));

// ── 10 편집기 ────────────────────────────────────────────
const qitem = (n, t, type, on) => `<div style="display:flex;gap:9px;align-items:center;padding:10px 12px;border-radius:9px;${on ? "background:var(--blue-bg);border:1px solid #cfe0f7" : ""}">
  <b style="font-size:11.5px;color:${on ? "var(--blue)" : "var(--muted)"}">Q${n}</b>
  <span style="flex:1;font-size:12.5px;font-weight:${on ? 750 : 600};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${t}</span>
  <span style="font-size:10.5px;color:var(--muted)">${type}</span></div>`;
W("10-editor.html", page("편집기", "⑩ 편집기", `
${navbar("")}${lockNote}
<div style="display:grid;grid-template-columns:250px minmax(0,1fr) 290px;gap:16px;max-width:1480px;margin:10px auto 0;padding:0 24px 30px">
  <aside class="panel" style="padding:10px;align-self:start">
    <div style="font-size:12px;font-weight:800;color:var(--muted);padding:6px 12px 10px">문항 10개 · 예상 4분</div>
    ${qitem(1, "현재 아르바이트를 하고 있나요?", "단일", false)}
    ${qitem(2, "주당 근무 시간은?", "단일", false)}
    ${qitem(3, "시급은 얼마인가요?", "단일", true)}
    ${qitem(4, "현재 시급에 만족하시나요?", "척도", false)}
    ${qitem(5, "가장 부담되는 지출은?", "복수", false)}
    <a style="display:block;text-align:center;padding:11px;border:1.5px dashed var(--line-dk);border-radius:9px;color:var(--muted);font-size:12.5px;font-weight:750;margin-top:8px">+ 문항 추가</a>
  </aside>
  <main class="panel" style="padding:24px;align-self:start">
    <div style="display:flex;justify-content:space-between;margin-bottom:14px">
      <span class="chip c">Q3 · 단일 선택</span>
      <div style="display:flex;gap:6px"><a class="btn sm">복제</a><a class="btn sm">삭제</a></div></div>
    <div style="font-size:19px;font-weight:800;letter-spacing:-.02em;padding-bottom:12px;border-bottom:2px solid var(--navy);margin-bottom:18px">현재 받는 시급은 얼마인가요?</div>
    ${["9,860원 미만 (최저시급 미만)", "9,860원~11,000원", "11,000원~13,000원", "13,000원 이상"].map(o =>
      `<div style="display:flex;gap:10px;align-items:center;padding:12px 14px;border:1px solid var(--line);border-radius:9px;margin-bottom:8px">
        <span style="width:17px;height:17px;border-radius:50%;border:2px solid var(--line-dk)"></span>
        <span style="flex:1;font-size:14.5px">${o}</span><span style="color:var(--muted)">⠿</span></div>`).join("")}
    <a style="display:inline-block;font-size:13px;color:var(--blue);font-weight:750;margin-top:4px">+ 선택지 추가</a>
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);margin-top:16px;padding-top:14px;font-size:13px;color:var(--muted)">
      <span>필수 응답 <b style="color:var(--blue)">켬</b> · 선택지 섞기 끔</span>
      <a class="cta" href="11-published.html" style="height:38px">게시하기 →</a></div>
  </main>
  <aside class="side">
    <div class="panel"><div class="rt">✨ AI로 바로 수정</div>
      <div style="padding:0 16px 16px">
        <div style="border:1px solid var(--line);border-radius:9px;padding:12px;font-size:13px;color:var(--muted);min-height:64px;margin-bottom:10px">예) 시급 구간을 더 잘게 나눠줘</div>
        <a class="cta" style="width:100%;justify-content:center">반영하기</a></div></div>
    <div class="panel"><div class="rt">게시 설정</div>
      <ul class="menu" style="padding-top:0">
        <li>보상 캐시<span style="color:var(--blue)">+30 C</span></li>
        <li>목표 응답<span>150명</span></li>
        <li>마감<span>9월 5일</span></li>
        <li>대상<span>전학년</span></li></ul></div>
  </aside>
</div>`));

// ── 11 게시 완료 ─────────────────────────────────────────
W("11-published.html", page("게시 완료", "⑪ 게시 완료", `
${navbar("")}${lockNote}
<div class="layout one" style="max-width:680px">
  <main style="padding-top:14px">
    <div class="panel" style="padding:34px;text-align:center">
      <div style="width:58px;height:58px;border-radius:50%;background:#e3f2ea;color:var(--green);font-size:26px;display:grid;place-items:center;margin:0 auto 14px">✓</div>
      <div class="h1" style="font-size:23px">설문이 게시됐어요</div>
      <div class="sub" style="margin-bottom:22px">이제 링크를 뿌리면 응답이 쌓입니다.</div>
      <div style="display:flex;gap:8px;margin-bottom:12px">
        <div class="search" style="flex:1;margin:0;font-family:ui-monospace,Consolas,monospace;font-size:13px">baroform.app/s/8f3a92c1d7e4</div>
        <a class="cta">링크 복사</a></div>
      <div style="display:flex;gap:8px;justify-content:center;margin-bottom:22px">
        <a class="btn" style="flex:0 0 auto;padding:0 16px">카카오톡 공유</a>
        <a class="btn" style="flex:0 0 auto;padding:0 16px">인스타 카드</a>
        <a class="btn sm">QR</a></div>
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;border:1px solid var(--line);border-radius:10px;overflow:hidden;text-align:left">
        <div style="padding:12px 14px"><span style="font-size:11.5px;color:var(--muted);font-weight:700">공개 범위</span><b style="display:block;font-size:13.5px;margin-top:3px">링크가 있는 모든 사람</b></div>
        <div style="padding:12px 14px;border-left:1px solid var(--line)"><span style="font-size:11.5px;color:var(--muted);font-weight:700">학교 설문 목록</span><b style="display:block;font-size:13.5px;margin-top:3px">게시 완료</b></div>
        <div style="padding:12px 14px;border-left:1px solid var(--line)"><span style="font-size:11.5px;color:var(--muted);font-weight:700">응답자 로그인</span><b style="display:block;font-size:13.5px;margin-top:3px">필요 없음</b></div>
      </div>
      <div style="display:flex;gap:8px;margin-top:20px">
        <a class="cta big" style="flex:1;justify-content:center" href="13-results-overview.html">결과 대시보드 열기 →</a>
        <a class="cta big ghost" style="flex:0 0 auto" href="12-respond.html">설문 화면 보기</a></div>
    </div>
  </main>
</div>`));

// ── 12 응답 화면 ─────────────────────────────────────────
W("12-respond.html", page("응답", "⑫ 응답", `
<div style="height:5px;background:#e8ecf1"><i style="display:block;height:100%;width:40%;background:var(--blue)"></i></div>
<div style="max-width:640px;margin:0 auto;padding:26px 20px">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
    <a class="brand" style="font-size:16px" href="01-landing.html"><span class="bmark" style="width:24px;height:24px"><i style="width:11px;top:8px"></i><i style="width:7px;top:14px"></i></span>바로폼</a>
    <span class="chip c" style="height:32px;padding:0 14px;border-radius:999px">로그인하면 완료 시 +30 C · 약 4분</span></div>
  <div class="panel" style="padding:26px">
    <span class="chip c" style="margin-bottom:12px">Q4 / 10 · 척도형</span>
    <div style="font-size:21px;font-weight:850;letter-spacing:-.025em;line-height:1.35;margin:10px 0 4px">현재 받는 시급에 얼마나 만족하시나요?</div>
    <div style="font-size:13px;color:var(--muted);margin-bottom:22px">1점 = 매우 불만족 · 5점 = 매우 만족</div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:9px;margin-bottom:8px">
      ${[1, 2, 3, 4, 5].map(n => `<div style="height:58px;border:1.5px solid ${n === 4 ? "var(--blue)" : "var(--line)"};border-radius:11px;display:grid;place-items:center;font-size:18px;font-weight:800;${n === 4 ? "background:var(--blue-bg);color:var(--blue)" : "color:var(--muted)"}">${n}</div>`).join("")}
    </div>
    <div style="display:flex;justify-content:space-between;font-size:11.5px;color:var(--muted);margin-bottom:24px"><span>매우 불만족</span><span>매우 만족</span></div>
    <div style="display:flex;gap:9px"><a class="cta ghost" style="flex:0 0 auto">← 이전</a><a class="cta big" style="flex:1;justify-content:center">다음 →</a></div>
  </div>
  <div style="text-align:center;font-size:12px;color:var(--muted);margin-top:16px">익명 응답 · 로그인 없이 참여할 수 있어요</div>
</div>`));

// ── 13/14 결과 ───────────────────────────────────────────
const resultsShell = (tab, inner) => `
${navbar("")}${lockNote}
<div class="layout one" style="max-width:1180px">
  <main style="padding-top:8px">
    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-bottom:14px">
      <div><div style="font-size:12px;color:var(--green);font-weight:800;margin-bottom:5px">● 응답 수집 중 · 마지막 업데이트 방금</div>
        <div class="h1" style="font-size:23px">아르바이트 경험과 시급 만족도 조사</div></div>
      <div style="display:flex;gap:8px"><a class="btn sm" style="height:40px" href="12-respond.html">설문 보기</a><a class="btn sm" style="height:40px">내보내기 ▾</a><a class="cta">결과 공유</a></div></div>
    <div class="tabs">${[["개요", "13-results-overview.html"], ["문항별 결과", "14-results-questions.html"], ["개별 응답", "#"], ["응답 품질", "#"]].map(([t, h]) => `<a href="${h}" class="${t === tab ? "on" : ""}">${t}</a>`).join("")}</div>
    ${inner}
  </main>
</div>`;
W("13-results-overview.html", page("결과 개요", "⑬ 결과·개요", resultsShell("개요", `
  <div class="panel pad" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:11px">
      <b style="font-size:18px;letter-spacing:-.02em">제출 42건</b><span style="font-size:12.5px;color:var(--muted)">이 중 38건을 분석에 반영</span></div>
    <div style="display:flex;height:32px;border-radius:8px;overflow:hidden;font-size:12px;font-weight:750;color:#fff">
      <div style="flex:30;background:var(--green);display:grid;place-items:center">이상 없음 30</div>
      <div style="flex:8;background:var(--orange);display:grid;place-items:center">검토 8</div>
      <div style="flex:4;background:var(--red);display:grid;place-items:center">제외 4</div></div></div>
  <div class="panel pad" style="margin-bottom:14px;background:linear-gradient(135deg,#f8fafd,#fff)">
    <span style="font-size:11.5px;font-weight:800;letter-spacing:.08em;color:var(--blue)">이 설문이 말하는 것</span>
    <div style="font-size:21px;font-weight:850;letter-spacing:-.025em;line-height:1.45;margin-top:9px">
      응답 38건 기준, <span style="color:var(--blue)">시급 만족도는 평균 2.8점</span>이고<br>가장 흔한 시급 구간은 <span style="color:var(--blue)">9,860원~11,000원(47%)</span>입니다.</div></div>
  <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:14px">
    <div class="panel"><div class="rt">문항별 핵심 결과<a href="14-results-questions.html">전체 보기 →</a></div>
      ${[["Q1", "현재 아르바이트 여부", "하고 있음 · 63%", 63], ["Q3", "시급 구간", "9,860~11,000원 · 47%", 47], ["Q4", "시급 만족도", "평균 2.8 / 5", 56]].map(([n, t, v, p]) =>
        `<div style="display:flex;gap:12px;align-items:center;padding:11px 16px;border-top:1px solid var(--line)">
          <b style="font-size:11px;color:var(--blue)">${n}</b><span style="flex:1;font-size:13.5px;font-weight:650">${t}</span>
          <div class="pbar" style="width:150px;margin:0"><i style="width:${p}%"></i></div>
          <b style="font-size:13px;width:150px;text-align:right">${v}</b></div>`).join("")}
    </div>
    <div class="panel"><div class="rt">응답 품질</div>
      <div style="padding:0 16px 16px;font-size:13.5px;color:var(--muted);line-height:1.6">확인이 남은 응답이 <b style="color:var(--text)">12건</b> 있어요.<br>제외해도 결론은 바뀌지 않습니다 (−0.1점).
      <a class="btn" style="margin-top:13px">품질 검사 결과 보기</a></div></div>
  </div>`)));
const vbar = (label, pct, count, top) => `<div style="display:grid;gap:6px;justify-items:center">
  <b style="font-size:13px">${pct}%</b>
  <div style="display:flex;align-items:flex-end;width:100%;height:110px"><i style="display:block;width:100%;border-radius:7px 7px 0 0;background:${top ? "var(--navy)" : "#a9b6c6"};height:${Math.max(4, pct)}%"></i></div>
  <span style="font-size:12px;font-weight:700;text-align:center">${label}</span>
  <span style="font-size:11px;color:var(--muted)">${count}명</span></div>`;
W("14-results-questions.html", page("결과 문항별", "⑭ 결과·문항별", resultsShell("문항별 결과", `
  <div class="panel pad" style="margin-bottom:14px">
    <div style="display:flex;justify-content:space-between;margin-bottom:6px">
      <b style="font-size:16px">Q3 현재 받는 시급은 얼마인가요?</b>
      <span style="display:flex;gap:6px"><span class="chip o">단일 선택</span><span class="chip o">응답 38건</span></span></div>
    <div style="font-size:12.5px;color:var(--muted);margin-bottom:16px">순서형 · 누적 16% → 63% → 87% → 100%</div>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px">
      ${vbar("9,860원 미만", 16, 6, false)}${vbar("9,860~11,000원", 47, 18, true)}${vbar("11,000~13,000원", 24, 9, false)}${vbar("13,000원 이상", 13, 5, false)}</div></div>
  <div class="panel pad">
    <div style="display:flex;justify-content:space-between;margin-bottom:16px">
      <b style="font-size:16px">Q4 현재 시급에 만족하시나요?</b>
      <span style="display:flex;gap:6px"><span class="chip o">척도형</span><span class="chip o">평균 2.8 / 5</span></span></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:12px">
      ${vbar("1점", 18, 7, false)}${vbar("2점", 29, 11, true)}${vbar("3점", 26, 10, false)}${vbar("4점", 18, 7, false)}${vbar("5점", 9, 3, false)}</div></div>`)));

console.log("preview site built: index + 14 pages");
