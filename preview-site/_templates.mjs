// ⑮ 템플릿 라이브러리 — 실서비스(baroform-fixed.vercel.app) 번들에서 추출한
// 실제 템플릿 레지스트리: 에브리타임 설문 318건 분석 기반 28종 + 공통 블록 12종
import { readFileSync, writeFileSync } from "node:fs";
import { navbar, page } from "./_components.mjs";

const data = JSON.parse(readFileSync("./_real-templates.json", "utf8"));
const BLOCKS = data.meta.common_field_blocks;
const templates = data.templates;

// 실서비스 필터 칩 표기 그대로 + 카테고리별 색/아이콘
const CATS = [
  ["동아리·학회 지원서", "동아리·학회", "#7a5af8", "🎪"],
  ["학과수업용", "수업·과제", "#2b6cd4", "📚"],
  ["논문·학술연구용", "학술연구", "#0f8a7e", "🔬"],
  ["수요검증(학생창업·공모전)", "수요검증", "#d97516", "🚀"],
  ["기업마케팅(스타트업·기업 캠페인)", "기업마케팅", "#c2366b", "📈"],
  ["기타(언론보도/개인부탁 등)", "기타", "#5b636f", "📄"],
];
const catMeta = (cat) => CATS.find(([f]) => f === cat) ?? ["기타", "기타", "#5b636f", "📄"];
const esc = (s) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// ── 필드 미리보기 렌더 ──────────────────────────────────
const radio = (opts) => `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px">${opts.map((o) =>
  `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#5b636f">
    <i style="width:13px;height:13px;border-radius:50%;border:1.5px solid #c3cad3;flex:none"></i>${esc(o)}</span>`).join("")}</div>`;
const check = (opts) => `<div style="display:flex;flex-wrap:wrap;gap:4px 14px;margin-top:6px">${opts.map((o) =>
  `<span style="display:inline-flex;align-items:center;gap:5px;font-size:12px;color:#5b636f">
    <i style="width:13px;height:13px;border-radius:4px;border:1.5px solid #c3cad3;flex:none"></i>${esc(o)}</span>`).join("")}</div>`;
const inputBox = (h) => `<div style="height:${h}px;border:1px solid var(--line-dk);border-radius:8px;background:#fff;margin-top:6px"></div>`;
const likert = (labels) => `<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-top:8px;gap:4px">${labels.map((l) =>
  `<span style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px">
    <i style="width:15px;height:15px;border-radius:50%;border:1.5px solid #c3cad3"></i>
    <em style="font-style:normal;font-size:10px;color:#8e97a3;text-align:center;line-height:1.3">${esc(l)}</em></span>`).join("")}</div>`;

const field = (f, i) => `<div style="padding:10px 0;border-top:${i ? "1px solid var(--line)" : "0"}">
  <div style="font-size:12.5px;font-weight:750;letter-spacing:-.01em">${i + 1 >= 0 ? "" : ""}${esc(f.label)}
    ${f.required ? `<span style="color:#cc4437;font-weight:800;margin-left:2px">*</span>` : ""}</div>
  ${f.type === "single_choice" ? radio(f.options ?? []) :
    f.type === "multi_choice" ? check(f.options ?? []) :
    f.type === "short_text" ? inputBox(30) :
    f.type === "long_text" ? inputBox(52) :
    f.type === "likert_5" ? likert(f.scale_labels ?? ["1", "2", "3", "4", "5"]) :
    f.type === "notice" ? "" : ""}
</div>`;

// ── 카드 ────────────────────────────────────────────────
const card = (t) => {
  const blocks = (t.common_blocks ?? []).map((id) => ({ id, ...BLOCKS[id] })).filter((b) => b.block_name);
  const previewFields = blocks.flatMap((b) => b.fields ?? []).slice(0, 2);
  const [, catShort, ac, icon] = catMeta(t.category);
  return `<details class="tpl" data-cat="${esc(t.category)}" style="--ac:${ac}">
  <summary>
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:11px">
      <span style="display:inline-flex;height:24px;align-items:center;gap:5px;padding:0 10px;border-radius:7px;background:${ac}14;color:${ac};font-size:11.5px;font-weight:800">${icon} ${catShort}</span>
      <span style="margin-left:auto;display:inline-flex;height:24px;align-items:center;padding:0 9px;border-radius:7px;background:#f2f4f7;color:#5b636f;font-size:11px;font-weight:750">사례 ${t.based_on_sample_count}건 기반</span></div>
    <div style="font-size:17px;font-weight:880;letter-spacing:-.03em;line-height:1.35">${esc(t.template_name)}</div>
    <div style="font-size:12px;color:var(--muted);font-weight:700;margin-top:5px">예상 문항 ${esc(t.estimated_item_count)}</div>
    <div style="font-size:12.5px;color:#5b636f;line-height:1.65;margin-top:9px">${esc(t.description)}</div>
    <div style="border-top:1px dashed var(--line-dk);margin:13px 0 0"></div>
    ${previewFields.length ? `<div style="background:#f7f8fa;border:1px solid var(--line);border-radius:11px;padding:6px 14px 12px;margin-top:13px">
      ${previewFields.map(field).join("")}</div>` : ""}
    <div class="tpl-cta">전체 구성 보기 ▾</div>
  </summary>
  <div style="border-top:1px solid var(--line);margin-top:14px;padding-top:12px">
    ${blocks.map((b) => `<div style="margin-bottom:13px">
      <div style="display:flex;align-items:baseline;gap:7px">
        <span style="font-size:13px;font-weight:800;letter-spacing:-.015em">${esc(b.block_name)}</span>
        <span style="font-size:11px;color:#9aa2ad;line-height:1.5">${esc(b.desc)}</span></div>
      ${(b.fields ?? []).length ? `<div style="background:#f7f8fa;border:1px solid var(--line);border-radius:10px;padding:2px 13px 8px;margin-top:7px">
        ${b.fields.map(field).join("")}</div>` : ""}
    </div>`).join("")}
    ${(t.topic_specific_sample_questions ?? []).length ? `<div style="margin-bottom:4px">
      <div style="font-size:13px;font-weight:800;letter-spacing:-.015em;margin-bottom:7px">주제별 추가 문항 예시</div>
      <div style="display:grid;gap:5px">${t.topic_specific_sample_questions.map((q) =>
        `<div style="font-size:12.5px;color:#4a515c;line-height:1.55">· ${esc(q)}</div>`).join("")}</div></div>` : ""}
  </div>
  <div style="display:flex;gap:8px;margin-top:15px">
    <a class="cta" style="flex:1;justify-content:center;background:var(--ac)" href="10-editor.html">이 템플릿 사용 →</a></div>
</details>`;
};

writeFileSync("15-templates.html", page("템플릿", "⑮ 템플릿", `
${navbar("")}
<style>
.tpl{background:#fff;border:1px solid var(--line);border-radius:16px;padding:18px;position:relative;overflow:hidden;
  transition:box-shadow .18s,transform .18s;border-top:3px solid var(--ac)}
.tpl:hover{transform:translateY(-3px);box-shadow:0 14px 34px rgba(20,40,80,.13)}
.tpl[open]{transform:none;box-shadow:0 10px 30px rgba(20,40,80,.12)}
.tpl summary{list-style:none;cursor:pointer}
.tpl summary::-webkit-details-marker{display:none}
.tpl-cta{font-size:12.5px;font-weight:800;color:var(--ac);margin-top:13px}
.tpl[open] .tpl-cta{color:var(--muted)}
.tplgrid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;align-items:start}
.catbar{display:flex;gap:7px;align-items:center;justify-content:center;flex-wrap:wrap;margin-bottom:26px}
.catbar a{display:inline-flex;height:38px;align-items:center;gap:6px;padding:0 17px;border-radius:999px;border:1px solid var(--line-dk);
  font-size:13.5px;font-weight:750;color:#4a515c;background:#fff;cursor:pointer;transition:all .15s}
.catbar a:hover{border-color:var(--navy);color:var(--navy)}
.catbar a.on{background:var(--navy);border-color:var(--navy);color:#fff;box-shadow:0 6px 16px rgba(20,40,80,.2)}
.catbar a.on b{color:#fff !important}
.tpl-hero{position:relative;text-align:center;padding:44px 0 30px}
.tpl-hero::before{content:"";position:absolute;inset:-80px -300px 0;z-index:-1;
  background:radial-gradient(560px 250px at 30% 0,#e6effd 0%,transparent 70%),
             radial-gradient(560px 250px at 70% 0,#efe9ff 0%,transparent 70%)}
@media (max-width:1100px){.tplgrid{grid-template-columns:1fr 1fr}}
</style>
<div class="layout one" style="max-width:1340px;padding-left:16px;padding-right:16px">
  <main>
    <div class="tpl-hero">
      <span style="display:inline-flex;height:28px;align-items:center;gap:6px;padding:0 13px;border-radius:999px;background:#fff;border:1px solid var(--line);color:var(--blue);font-size:12.5px;font-weight:800;margin-bottom:16px;box-shadow:0 2px 8px rgba(20,40,80,.06)">⚡ ${esc(data.meta.source)}</span>
      <div style="font-size:46px;font-weight:900;letter-spacing:-.05em;line-height:1.15">템플릿 <span style="background:linear-gradient(100deg,var(--blue),#7a5af8);-webkit-background-clip:text;background-clip:text;color:transparent">${templates.length}종</span>에서 시작하기</div>
      <div style="color:var(--muted);font-size:15.5px;margin-top:13px;line-height:1.6">실제 대학가 설문 318건을 분석해 만든 구조입니다.<br>골라서 문구만 다듬으면 바로 배포할 수 있어요.</div></div>
    <div class="catbar">
      <a class="on" data-f="*">전체 <b>${templates.length}</b></a>
      ${CATS.map(([full, s, ac, icon]) => `<a data-f="${esc(full)}">${icon} ${s} <b style="color:${ac}">${templates.filter((t) => t.category === full).length}</b></a>`).join("")}
      <span style="width:1px;height:22px;background:var(--line-dk);margin:0 4px"></span>
      <a href="10-editor.html" style="border-style:dashed">📝 직접 구성하기</a></div>
    <div class="tplgrid" id="grid">${templates.map(card).join("")}</div>
    <div style="text-align:center;font-size:12.5px;color:var(--muted);line-height:1.7;padding:20px 0 10px">
      템플릿 이름·설명·문항 블록은 실서비스 템플릿 레지스트리에서 그대로 가져왔습니다.</div>
  </main>
</div>
<script>
document.querySelectorAll(".catbar a[data-f]").forEach((b) => b.addEventListener("click", () => {
  document.querySelectorAll(".catbar a").forEach((x) => x.classList.remove("on"));
  b.classList.add("on");
  const f = b.dataset.f;
  document.querySelectorAll(".tpl").forEach((c) => { c.style.display = (f === "*" || c.dataset.cat === f) ? "" : "none"; });
}));
</script>`));
console.log(`15-templates.html: ${templates.length}종 / 블록 ${Object.keys(BLOCKS).length}종`);
