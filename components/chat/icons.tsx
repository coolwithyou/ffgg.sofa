/**
 * 채팅 UI 공통 아이콘
 * widget-chat.tsx, chatbot-block.tsx에서 공유
 */

/**
 * 전송 아이콘 (Send)
 * 메시지 전송 버튼에 사용
 */
export function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
}
