'use client';

/**
 * 개인정보처리방침 페이지
 */

import Link from 'next/link';

export default function PrivacyPolicyPage() {
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
        <h1 className="mb-8 text-3xl font-bold text-gray-900">개인정보처리방침</h1>

        <div className="prose prose-gray max-w-none">
          <p className="text-gray-600">시행일: 2024년 1월 1일</p>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">1. 개인정보의 처리 목적</h2>
            <p className="mt-4 text-gray-700">
              SOFA(이하 &quot;회사&quot;)는 다음의 목적을 위하여 개인정보를 처리합니다.
              처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며,
              이용 목적이 변경되는 경우에는 개인정보보호법 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>회원 가입 및 관리: 회원제 서비스 제공에 따른 본인 확인, 회원자격 유지·관리, 서비스 부정이용 방지</li>
              <li>서비스 제공: RAG 기반 챗봇 서비스 제공, 문서 관리 및 처리, 대화 기록 관리</li>
              <li>고객 문의 및 불만 처리: 민원인의 신원 확인, 민원사항 확인, 처리결과 통보</li>
              <li>마케팅 및 광고: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">2. 개인정보의 처리 및 보유 기간</h2>
            <p className="mt-4 text-gray-700">
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에
              동의받은 개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>회원 정보: 회원 탈퇴 시까지 (단, 관계 법령에 따라 보존이 필요한 경우 해당 기간)</li>
              <li>접속 기록: 1년 (통신비밀보호법)</li>
              <li>계약 또는 청약철회 등에 관한 기록: 5년 (전자상거래법)</li>
              <li>대금결제 및 재화 등의 공급에 관한 기록: 5년 (전자상거래법)</li>
              <li>소비자의 불만 또는 분쟁처리에 관한 기록: 3년 (전자상거래법)</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">3. 처리하는 개인정보의 항목</h2>
            <p className="mt-4 text-gray-700">회사는 다음의 개인정보 항목을 처리하고 있습니다.</p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>필수항목: 이메일 주소, 비밀번호(암호화), 회사명, 담당자명</li>
              <li>선택항목: 연락처</li>
              <li>서비스 이용 과정에서 자동 수집되는 정보: IP 주소, 쿠키, 서비스 이용 기록, 접속 로그</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">4. 개인정보의 제3자 제공</h2>
            <p className="mt-4 text-gray-700">
              회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며,
              정보주체의 동의, 법률의 특별한 규정 등 개인정보보호법 제17조 및 제18조에 해당하는 경우에만
              개인정보를 제3자에게 제공합니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">5. 개인정보 처리의 위탁</h2>
            <p className="mt-4 text-gray-700">
              회사는 서비스 제공을 위해 다음과 같이 개인정보 처리업무를 위탁하고 있습니다.
            </p>
            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full border-collapse border border-gray-300">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-4 py-2 text-left">수탁업체</th>
                    <th className="border border-gray-300 px-4 py-2 text-left">위탁 업무</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">OpenAI, Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">대화 응답 생성 및 문서 임베딩 생성</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Neon Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">데이터베이스 호스팅 및 관리</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-300 px-4 py-2">Vercel Inc.</td>
                    <td className="border border-gray-300 px-4 py-2">웹 애플리케이션 호스팅</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">6. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="mt-4 text-gray-700">
              정보주체는 회사에 대해 언제든지 다음 각 호의 개인정보 보호 관련 권리를 행사할 수 있습니다.
            </p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
            <p className="mt-4 text-gray-700">
              권리 행사는 회사에 대해 서면, 전자우편 등을 통하여 하실 수 있으며,
              회사는 이에 대해 지체없이 조치하겠습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">7. 개인정보의 안전성 확보조치</h2>
            <p className="mt-4 text-gray-700">
              회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
            </p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>관리적 조치: 내부관리계획 수립·시행, 정기적 직원 교육</li>
              <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 개인정보의 암호화, 보안프로그램 설치</li>
              <li>물리적 조치: 전산실, 자료보관실 등의 접근통제</li>
            </ul>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">8. 개인정보 보호책임자</h2>
            <p className="mt-4 text-gray-700">
              회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고,
              개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이
              개인정보 보호책임자를 지정하고 있습니다.
            </p>
            <div className="mt-4 rounded-lg bg-gray-100 p-4 text-gray-700">
              <p><strong>개인정보 보호책임자</strong></p>
              <p>성명: [담당자명]</p>
              <p>직책: [직책]</p>
              <p>연락처: [이메일], [전화번호]</p>
            </div>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">9. 개인정보처리방침의 변경</h2>
            <p className="mt-4 text-gray-700">
              이 개인정보처리방침은 2024년 1월 1일부터 적용됩니다.
              이전의 개인정보처리방침은 아래에서 확인하실 수 있습니다.
            </p>
          </section>

          <section className="mt-8">
            <h2 className="text-xl font-semibold text-gray-900">10. 개인정보 침해 관련 상담 및 신고</h2>
            <p className="mt-4 text-gray-700">
              개인정보 침해에 대한 피해구제, 상담 등이 필요하신 경우 아래 기관에 문의하시기 바랍니다.
            </p>
            <ul className="mt-4 list-disc pl-6 text-gray-700">
              <li>개인정보침해신고센터 (privacy.kisa.or.kr / 국번없이 118)</li>
              <li>대검찰청 사이버수사과 (www.spo.go.kr / 국번없이 1301)</li>
              <li>경찰청 사이버안전국 (cyberbureau.police.go.kr / 국번없이 182)</li>
            </ul>
          </section>
        </div>

        {/* 하단 네비게이션 */}
        <div className="mt-12 flex items-center justify-between border-t pt-8">
          <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">
            ← 홈으로 돌아가기
          </Link>
          <Link href="/terms" className="text-sm text-orange-500 hover:text-orange-600">
            이용약관 보기 →
          </Link>
        </div>
      </main>
    </div>
  );
}
