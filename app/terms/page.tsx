'use client';

/**
 * 이용약관 페이지
 */

import Link from 'next/link';

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <header className="border-b bg-white">
        <div className="mx-auto max-w-4xl px-4 py-4">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500">
              <span className="text-lg font-bold text-white">S</span>
            </div>
            <span className="text-xl font-bold text-gray-900">SOFA</span>
          </Link>
        </div>
      </header>

      {/* 본문 */}
      <main className="mx-auto max-w-4xl px-4 py-12">
        <h1 className="mb-8 text-3xl font-bold text-gray-900">서비스 이용약관</h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600">시행일: 2024년 1월 1일</p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제1조 (목적)</h2>
            <p className="mt-4 text-gray-700">
              이 약관은 SOFA(이하 &quot;회사&quot;)가 제공하는 기업용 RAG 챗봇 서비스(이하 &quot;서비스&quot;)의
              이용조건 및 절차, 회사와 이용자의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제2조 (정의)</h2>
            <p className="mt-4 text-gray-700">이 약관에서 사용하는 용어의 정의는 다음과 같습니다.</p>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>&quot;서비스&quot;란 회사가 제공하는 RAG(Retrieval-Augmented Generation) 기반 AI 챗봇 서비스를 말합니다.</li>
              <li>&quot;이용자&quot;란 이 약관에 동의하고 회사와 서비스 이용계약을 체결한 기업 또는 개인을 말합니다.</li>
              <li>&quot;테넌트&quot;란 서비스를 이용하는 각 기업 또는 조직의 독립된 데이터 공간을 말합니다.</li>
              <li>&quot;문서&quot;란 이용자가 서비스에 업로드하는 텍스트, PDF 등의 파일을 말합니다.</li>
              <li>&quot;챗봇&quot;이란 업로드된 문서를 기반으로 질문에 답변하는 AI 시스템을 말합니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제3조 (약관의 효력 및 변경)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>이 약관은 서비스를 이용하고자 하는 모든 이용자에게 적용됩니다.</li>
              <li>회사는 필요한 경우 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.</li>
              <li>이용자가 변경된 약관에 동의하지 않는 경우, 서비스 이용을 중단하고 탈퇴할 수 있습니다.</li>
              <li>변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우, 변경된 약관에 동의한 것으로 간주합니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제4조 (서비스의 제공)</h2>
            <p className="mt-4 text-gray-700">회사가 제공하는 서비스의 내용은 다음과 같습니다.</p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>문서 업로드 및 관리 기능</li>
              <li>문서 기반 AI 챗봇 서비스</li>
              <li>웹 위젯 및 카카오톡 연동 서비스</li>
              <li>대화 기록 관리 및 분석 기능</li>
              <li>기타 회사가 추가 개발하거나 제휴를 통해 제공하는 서비스</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제5조 (서비스 이용 요금)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>서비스는 유료로 제공되며, 요금은 회사의 요금 정책에 따릅니다.</li>
              <li>회사는 요금을 변경할 수 있으며, 변경 시 30일 전에 공지합니다.</li>
              <li>이용자는 서비스 이용 요금을 기한 내에 납부해야 하며, 연체 시 서비스 이용이 제한될 수 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제6조 (이용자의 의무)</h2>
            <p className="mt-4 text-gray-700">이용자는 다음 각 호의 행위를 해서는 안 됩니다.</p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>타인의 개인정보를 도용하거나 부정하게 사용하는 행위</li>
              <li>서비스를 이용하여 불법적인 콘텐츠를 생성하거나 배포하는 행위</li>
              <li>서비스의 안정적인 운영을 방해하는 행위</li>
              <li>회사의 지적재산권을 침해하는 행위</li>
              <li>악성코드나 바이러스가 포함된 파일을 업로드하는 행위</li>
              <li>기타 관련 법령에 위반되는 행위</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제7조 (데이터 소유권)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>이용자가 서비스에 업로드한 문서 및 데이터의 소유권은 이용자에게 있습니다.</li>
              <li>회사는 서비스 제공을 위해 이용자의 데이터를 처리할 수 있으나, 이용자의 동의 없이 제3자에게 제공하지 않습니다.</li>
              <li>이용자가 서비스를 탈퇴하는 경우, 관련 법령에서 정한 기간을 제외하고 이용자의 데이터는 삭제됩니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제8조 (서비스 이용의 제한 및 중지)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>회사는 다음의 경우 서비스 제공을 중지하거나 이용을 제한할 수 있습니다.
                <ul className="mt-2 list-disc pl-6">
                  <li>서비스 설비의 보수 등 공사로 인한 부득이한 경우</li>
                  <li>이용자가 본 약관을 위반한 경우</li>
                  <li>기타 천재지변, 비상사태 등의 사유가 발생한 경우</li>
                </ul>
              </li>
              <li>회사는 서비스 중지 시 사전에 공지하며, 불가피한 경우 사후에 공지할 수 있습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제9조 (면책조항)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>회사는 천재지변, 전쟁, 기타 불가항력으로 인해 서비스를 제공할 수 없는 경우 책임이 면제됩니다.</li>
              <li>회사는 AI 기술의 특성상 챗봇이 제공하는 응답의 정확성을 100% 보장하지 않습니다.</li>
              <li>이용자가 업로드한 문서의 내용 및 이로 인해 발생하는 문제에 대해 회사는 책임지지 않습니다.</li>
              <li>이용자의 귀책사유로 인한 서비스 이용 장애에 대해 회사는 책임지지 않습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제10조 (손해배상)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>회사 또는 이용자가 본 약관을 위반하여 상대방에게 손해를 끼친 경우, 그 손해를 배상할 책임이 있습니다.</li>
              <li>회사의 손해배상 책임은 월 서비스 이용료를 초과하지 않습니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제11조 (계약 해지)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>이용자는 언제든지 서비스 해지를 요청할 수 있습니다.</li>
              <li>회사는 이용자가 본 약관을 위반한 경우, 사전 통지 후 계약을 해지할 수 있습니다.</li>
              <li>해지 시 이미 납부한 서비스 요금의 환불은 회사의 환불 정책에 따릅니다.</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">제12조 (분쟁 해결)</h2>
            <ul className="mt-4 list-decimal pl-6 text-gray-700">
              <li>본 약관에 명시되지 않은 사항은 관련 법령에 따릅니다.</li>
              <li>서비스 이용과 관련하여 분쟁이 발생한 경우, 당사자 간 원만한 합의를 통해 해결하도록 노력합니다.</li>
              <li>분쟁이 해결되지 않는 경우, 관할 법원은 회사 본사 소재지를 관할하는 법원으로 합니다.</li>
            </ul>
          </section>

          <section className="mt-8 rounded-lg bg-gray-100 p-6">
            <h2 className="text-xl font-semibold text-gray-900">부칙</h2>
            <p className="mt-4 text-gray-700">이 약관은 2024년 1월 1일부터 시행합니다.</p>
          </section>
        </div>

        {/* 하단 네비게이션 */}
        <div className="mt-12 flex items-center justify-between border-t pt-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← 홈으로 돌아가기
          </Link>
          <Link href="/privacy" className="text-sm text-orange-500 hover:text-orange-600">
            개인정보처리방침 보기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
