// 바로폼 리디자인 프리뷰 사이트 — 비로그인 기준, 실제 코드 아님
// 페이지끼리 링크로 이어져 실제 사이트처럼 둘러볼 수 있다.

export const CSS = `
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css');
:root{
  --bg:#f4f6f8; --surface:#fff; --line:#e5e8ee; --line-dk:#d4dae2;
  --navy:#1c3a6b; --navy-dk:#142c52; --blue:#2b6cd4; --blue-bg:#edf3fc;
  --text:#191c21; --muted:#79818d; --green:#178a5c; --orange:#d97516; --red:#cc4437;
}
*{box-sizing:border-box;margin:0}
html,body{overflow-x:clip}
body{background:var(--bg);color:var(--text);word-break:keep-all;
  font-family:"Pretendard Variable",Pretendard,"Malgun Gothic",sans-serif;font-size:14px}
a{text-decoration:none;color:inherit;cursor:pointer}
.pvbar{display:flex;gap:14px;align-items:center;padding:7px 28px;background:#142c52;color:#9fb4d6;font-size:12px}
.pvbar b{color:#fff;font-weight:750}
.pvbar a{color:#cddcf5;font-weight:650}
.pvbar a:hover{color:#fff}
.navbar.nb-over{position:absolute;top:0;left:0;right:0;z-index:3;background:transparent;border-bottom:0;height:72px}
.navbar.nb-over .brand{color:#fff}
.navbar.nb-over .bmark{background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.34)}
.navbar.nb-over .nav a{color:rgba(255,255,255,.86)}
.navbar.nb-over .nav a:hover,.navbar.nb-over .nav a.on{color:#fff}
.navbar.nb-over .loginlink{color:rgba(255,255,255,.86)}
.navbar.nb-over .cta{background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.4);color:#fff;backdrop-filter:blur(8px)}
.navbar.nb-over .cta.ghost{background:#fff;color:var(--navy);border-color:#fff}
.navbar{display:flex;align-items:center;gap:26px;padding:0 28px;height:64px;
  background:#fff;border-bottom:1px solid var(--line);position:sticky;top:0;z-index:50}
.brand{display:flex;align-items:center;gap:9px;font-size:19px;font-weight:800;letter-spacing:-.04em}
.bmark{width:28px;height:28px;border-radius:8px;background:var(--navy);position:relative}
.bmark i{position:absolute;left:7px;height:3px;border-radius:2px;background:#fff;display:block}
.bmark i:first-child{top:9px;width:13px}.bmark i:last-child{top:16px;width:8px}
.cta{display:inline-flex;align-items:center;gap:7px;height:42px;padding:0 18px;border-radius:9px;
  background:var(--navy);color:#fff;font-size:14.5px;font-weight:750}
.cta:hover{background:var(--navy-dk)}
.cta.big{height:48px;padding:0 24px;font-size:15.5px}
.cta.ghost{background:#fff;color:var(--navy);border:1.5px solid var(--line-dk)}
.nav{display:flex;gap:24px;font-size:15px;font-weight:600;color:#3d4451}
.nav .on{color:var(--navy);font-weight:800}
.nav-r{margin-left:auto;display:flex;align-items:center;gap:14px}
.loginlink{font-weight:650;color:#3d4451}
.badge-preview{display:inline-flex;align-items:center;height:28px;padding:0 11px;border-radius:999px;
  background:#fbf3e3;color:#9a6a10;font-size:12px;font-weight:750}
.layout{display:grid;grid-template-columns:256px minmax(0,1fr) 296px;gap:18px;
  max-width:1480px;margin:0 auto;padding:18px 24px 40px}
.layout.two{grid-template-columns:256px minmax(0,1fr)}
.layout.one{grid-template-columns:minmax(0,1fr)}
.panel{background:var(--surface);border:1px solid var(--line);border-radius:12px}
.pad{padding:16px}
.side>.panel{margin-bottom:14px}
.tabs{display:flex;gap:22px;border-bottom:1px solid var(--line);padding:0 2px;margin-bottom:14px}
.tabs a{padding:10px 2px 12px;font-size:15.5px;font-weight:650;color:var(--muted)}
.tabs a small{font-weight:700;margin-left:4px}
.tabs .on{color:var(--navy);font-weight:800;border-bottom:2.5px solid var(--navy)}
.search{display:flex;align-items:center;gap:9px;height:44px;padding:0 15px;border-radius:10px;
  background:#fff;border:1px solid var(--line);color:var(--muted);margin-bottom:12px}
.sort{display:flex;gap:16px;justify-content:flex-end;font-size:13px;color:var(--muted);
  font-weight:650;margin-bottom:14px}
.sort .on{color:var(--navy);font-weight:800}
.grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:15px}
.grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px}
.thumb{position:relative;height:148px;border-radius:12px 12px 0 0;overflow:hidden;
  background:linear-gradient(135deg,#2c4a7c,#16294a)}
.thumb img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;opacity:.85}
.thumb::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,20,40,.15),rgba(8,16,34,.62))}
.tcat{position:absolute;z-index:2;top:10px;left:10px;padding:4px 9px;border-radius:6px;
  background:rgba(12,22,44,.72);color:#fff;font-size:11.5px;font-weight:750}
.ttitle{position:absolute;z-index:2;left:14px;bottom:12px;right:14px;color:#fff;
  font-size:21px;font-weight:850;line-height:1.22;letter-spacing:-.03em;
  text-shadow:0 2px 10px rgba(0,0,0,.4)}
.sbody{padding:13px 14px 14px}
.chiprow{display:flex;gap:6px;margin-bottom:9px}
.chip{display:inline-flex;align-items:center;height:24px;padding:0 9px;border-radius:6px;
  font-size:12px;font-weight:800}
.chip.c{background:var(--blue-bg);color:var(--blue)}
.chip.o{border:1px solid var(--line-dk);color:var(--muted);font-weight:700;background:#fff}
.qt{font-size:15.5px;font-weight:750;letter-spacing:-.02em;margin-bottom:4px}
.au{font-size:12.5px;color:var(--muted);margin-bottom:11px}
.meta{display:flex;justify-content:space-between;font-size:12.5px;color:var(--muted);
  padding-top:10px;border-top:1px solid var(--line)}
.meta b{color:var(--text)}
.goal{display:flex;justify-content:space-between;font-size:12.5px;margin:8px 0 6px}
.goal b{font-weight:800}.goal .dd{color:var(--red);font-weight:800}
.pbar{height:6px;border-radius:99px;background:#e8ecf1;overflow:hidden;margin-bottom:12px}
.pbar i{display:block;height:100%;background:var(--blue)}
.btnrow{display:flex;gap:7px}
.btn{flex:1;height:38px;border-radius:8px;border:1.5px solid var(--blue);color:var(--blue);
  background:#fff;font-size:13.5px;font-weight:800;display:grid;place-items:center}
.btn:hover{background:var(--blue-bg)}
.btn.sm{flex:0 0 auto;padding:0 13px;border-color:var(--line-dk);color:var(--muted);font-weight:700}
.rt{font-size:15px;font-weight:800;padding:14px 16px 10px;display:flex;justify-content:space-between;align-items:center}
.rt a{font-size:12px;color:var(--muted);font-weight:650}
.rank{list-style:none;padding:0 0 6px}
.rank li{display:flex;gap:11px;padding:9px 16px}
.rank b.no{color:var(--blue);font-size:14px;width:12px}
.rank .t{font-size:13.5px;font-weight:650;line-height:1.35}
.rank .s{font-size:11.5px;color:var(--muted);margin-top:3px}
.poll{padding:0 16px 16px}
.pop{position:relative;height:38px;border-radius:8px;background:#eef1f5;margin-bottom:8px;overflow:hidden}
.pop i{position:absolute;inset:0;background:var(--blue-bg);border-radius:8px}
.pop.win i{background:#dbe8fb}
.pop span{position:absolute;left:13px;top:0;bottom:0;display:flex;align-items:center;font-size:13px;font-weight:750}
.pop em{position:absolute;right:13px;top:0;bottom:0;display:flex;align-items:center;font-style:normal;
  font-size:13px;font-weight:800;color:var(--blue)}
.poll .ps{font-size:12px;color:var(--muted)}
.h1{font-size:26px;font-weight:850;letter-spacing:-.035em}
.sub{color:var(--muted);font-size:14px;margin-top:5px}
.menu{list-style:none;padding:4px 0}
.menu li{display:flex;justify-content:space-between;padding:11px 16px;font-size:13.5px;font-weight:650}
.menu li+li{border-top:1px solid var(--line)}
.menu li span{color:var(--muted);font-weight:700}
`;

// 프리뷰 안내 바: 실제 서비스가 아님을 항상 표시 + 화면 목차로
export function pvbar(cur) {
  return `<div class="pvbar"><b>바로폼 리디자인 프리뷰</b><span>실제 서비스가 아닙니다 · 데이터는 전부 예시</span>
  <span style="margin-left:auto"></span><a href="index.html">전체 화면 목차 ↗</a><span>현재: ${cur}</span></div>`;
}

// 비로그인 상단바
export function navbar(active, opts = {}) {
  const ov = opts.overlay;
  const items = [["참여하기", "02-feed.html"], ["커뮤니티", "04-community.html"], ["캠퍼스 투표", "03-pulses.html"], ["협업", "05-workspace.html"], ["리서치 의뢰", "#"]];
  return `<div class="navbar${ov ? " nb-over" : ""}">
    <a class="brand" href="01-landing.html"><span class="bmark"><i></i><i></i></span>바로폼</a>
    ${ov ? "" : `<a class="cta" href="08-create.html">+ 설문 만들기</a>`}
    <nav class="nav">${items.map(([i, h]) => `<a href="${h}" class="${i === active ? "on" : ""}">${i}</a>`).join("")}</nav>
    <div class="nav-r"><a class="loginlink" href="07-login.html">로그인</a><a class="cta ghost" href="07-login.html">무료로 시작하기</a></div>
  </div>`;
}

// 비로그인 사이드바: 프로필 대신 로그인 유도 + 서비스 현황
export function guestSidebar() {
  return `<aside class="side">
    <div class="panel pad">
      <div style="font-size:15.5px;font-weight:800;letter-spacing:-.02em;line-height:1.4;margin-bottom:7px">로그인하면<br>응답할 때마다 캐시 적립</div>
      <div style="font-size:12.5px;color:var(--muted);line-height:1.6;margin-bottom:13px">학교 이메일로 가입하면 우리 학교 설문이 먼저 보여요.</div>
      <a class="cta" style="width:100%;justify-content:center" href="07-login.html">학교 이메일로 시작</a>
    </div>
    <div class="panel"><ul class="menu">
      <li>오늘 열린 설문<span style="color:var(--blue)">142</span></li>
      <li>이번 주 지급된 캐시<span>84,200 C</span></li>
      <li>참여 대학<span>8개교</span></li>
      <li>평균 완료율<span style="color:var(--green)">91%</span></li>
    </ul></div>
  </aside>`;
}

export function rightRail() {
  return `<aside class="side">
    <div class="panel">
      <div class="rt">실시간 인기 글<a href="04-community.html">더 보기</a></div>
      <ol class="rank">
        <li><b class="no">1</b><div><div class="t">설문 문항 200개짜리 돌려본 후기</div><div class="s">자유게시판 · 179 · 43</div></div></li>
        <li><b class="no">2</b><div><div class="t">응답자 100명 모으는 데 얼마 들었나</div><div class="s">운영 팁 · 66 · 18</div></div></li>
        <li><b class="no">3</b><div><div class="t">객관식만 쓰면 안 되는 이유</div><div class="s">설계 질문 · 54 · 27</div></div></li>
        <li><b class="no">4</b><div><div class="t">IRB 통과한 문항 공유합니다</div><div class="s">자료실 · 41 · 9</div></div></li>
        <li><b class="no">5</b><div><div class="t">리커트 5점 vs 7점, 뭐 쓰세요?</div><div class="s">설계 질문 · 38 · 52</div></div></li>
      </ol>
    </div>
    <div class="panel">
      <div class="rt">이번 학기 셔틀 증차, 필요할까요?</div>
      <div class="poll">
        <div style="display:flex;align-items:center;gap:7px">
          <div style="flex:1;height:62px;border-radius:10px;background:linear-gradient(158deg,#33578f,#1a3763);display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#fff">
            <b style="font-size:19px;letter-spacing:-.03em;line-height:1">68<span style="font-size:11px">%</span></b>
            <span style="font-size:11px;font-weight:750;color:rgba(255,255,255,.9)">필요하다</span></div>
          <span style="font-size:9.5px;font-weight:900;color:#b3bac4">VS</span>
          <div style="flex:1;height:62px;border-radius:10px;background:#eef1f7;border:1px solid #d3dced;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;color:#1c3a6b">
            <b style="font-size:19px;letter-spacing:-.03em;line-height:1">32<span style="font-size:11px">%</span></b>
            <span style="font-size:11px;font-weight:750">지금이면 충분</span></div></div>
        <div class="ps">1,204명 참여 · 오늘 마감 · <a href="03-pulses.html" style="color:var(--blue);font-weight:750">투표하러 가기</a></div>
      </div>
    </div>
  </aside>`;
}

export function surveyCard({ seed, cat, big, cash, q, au, n, min, done, goal, dday, hot }) {
  const pct = Math.min(100, Math.round((done / goal) * 100));
  return `<div class="panel">
    <div class="thumb"><img src="https://picsum.photos/seed/${seed}/420/220" alt="">
      <span class="tcat">${cat}</span><div class="ttitle">${big}</div></div>
    <div class="sbody">
      <div class="chiprow"><span class="chip c">+${cash} C</span><span class="chip o">${hot}</span></div>
      <div class="qt">${q}</div><div class="au">${au}</div>
      <div class="meta"><span>문항 <b>${n}</b></span><span>예상 <b>${min}분</b></span></div>
      <div class="goal"><span>응답 <b>${done}</b> / 목표 ${goal}</span><span class="${dday.startsWith("D-") && +dday.slice(2) <= 3 ? "dd" : ""}"><b>마감 ${dday}</b></span></div>
      <div class="pbar"><i style="width:${pct}%"></i></div>
      <div class="btnrow"><a class="btn" href="12-respond.html">응답하기</a><a class="btn sm" href="13-results-overview.html">결과</a><a class="btn sm">↗</a></div>
    </div>
  </div>`;
}

export function page(title, cur, body, opts = {}) {
  return `<!doctype html><html lang="ko"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${title} — 바로폼 프리뷰</title><style>${CSS}${MOBILE_CSS}</style><body>${opts.bare ? "" : pvbar(cur)}${body}</body></html>`;
}

// 모바일 오버라이드 — 데스크톱 디자인은 그대로 두고 760px 이하에서만 적용
export const MOBILE_CSS = `
@media (max-width:760px){
  .pvbar{flex-wrap:wrap;row-gap:2px;padding:7px 14px}
  .navbar{flex-wrap:wrap;height:auto;padding:10px 14px;gap:8px 14px}
  .navbar .nav{order:5;width:100%;gap:16px;overflow-x:auto;padding-bottom:2px}
  .navbar .nav-r{margin-left:auto;gap:8px}
  .navbar .cta{height:38px;padding:0 13px;font-size:13.5px}
  .navbar.nb-over{height:auto}
  .layout{grid-template-columns:1fr !important;padding:14px 14px 40px;gap:14px}
  .layout>main{order:1}
  .layout>.side{order:2}
  .layout>aside:not(.side){order:3}
  .grid2,.grid3,.tplgrid{grid-template-columns:1fr !important}
  /* 인라인 grid: 기본은 한 열, 균등 반복 그리드(KPI류)만 두 열 */
  [style*="grid-template-columns"]{grid-template-columns:1fr !important}
  [style*="grid-template-columns:repeat("]{grid-template-columns:repeat(2,minmax(0,1fr)) !important}
  /* 큰 표제 축소 */
  [style*="font-size:60px"]{font-size:34px !important}
  [style*="font-size:54px"]{font-size:30px !important}
  [style*="font-size:46px"]{font-size:28px !important}
  [style*="font-size:40px"]{font-size:27px !important}
  /* 랜딩 통계·CTA 줄바꿈 */
  [style*="gap:46px"]{gap:18px 28px !important;flex-wrap:wrap;justify-content:center}
  [style*="display:flex"][style*="gap:12px"],[style*="display:flex"][style*="gap:8px"]{flex-wrap:wrap}
  /* 표는 제자리 가로 스크롤 */
  main table,.panel table{display:block;overflow-x:auto}
  .catbar a{height:34px;padding:0 13px;font-size:12.5px}
  .tpl-hero{padding:30px 0 22px}
}`;
