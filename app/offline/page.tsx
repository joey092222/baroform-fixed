import Link from "next/link";

export default function OfflinePage() {
  return (
    <main className="pwa-offline">
      <span className="brand-mark" aria-hidden>
        <span />
        <span />
      </span>
      <p className="pwa-offline-kicker">BAROFORM</p>
      <h1>지금은 연결이 끊겼어요.</h1>
      <p>
        인터넷 연결을 확인한 뒤 다시 시도해주세요. 작성 중인 내용은 이 화면을
        닫기 전에 연결이 돌아오면 계속 사용할 수 있습니다.
      </p>
      <Link href="/?app=1">다시 연결하기</Link>
    </main>
  );
}
