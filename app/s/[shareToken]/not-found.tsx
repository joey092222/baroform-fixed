import Link from "next/link";

export default function SurveyNotFound() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
        background: "#f6f3eb",
        color: "#0b1f3a",
      }}
    >
      <section
        style={{
          width: "min(100%, 620px)",
          padding: "48px 36px",
          border: "1px solid #d8d5cc",
          borderRadius: 18,
          background: "#fcfbf7",
          textAlign: "center",
        }}
      >
        <span style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em" }}>
          BAROFORM
        </span>
        <h1 style={{ margin: "18px 0 10px", fontSize: 32, lineHeight: 1.25 }}>
          공개된 설문을 찾을 수 없어요.
        </h1>
        <p style={{ margin: "0 0 28px", color: "#626873", lineHeight: 1.7 }}>
          링크가 올바른지 확인하거나 설문 게시자에게 공개 상태를 확인해주세요.
        </p>
        <Link
          href="/?app=1"
          style={{
            display: "inline-flex",
            padding: "13px 20px",
            borderRadius: 999,
            background: "#0b1f3a",
            color: "white",
            fontWeight: 800,
            textDecoration: "none",
          }}
        >
          다른 설문 둘러보기
        </Link>
      </section>
    </main>
  );
}
