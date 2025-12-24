/**
 * 설정 페이지
 * [Week 9] 테넌트 설정 관리
 */

import { getTenantSettings, getWidgetEmbedCode } from './actions';
import { KakaoSettingsForm } from './kakao-settings';
import { WidgetSettingsForm } from './widget-settings';
import { EmbedCodeSection } from './embed-code';

export default async function SettingsPage() {
  const [settings, embedCode] = await Promise.all([
    getTenantSettings(),
    getWidgetEmbedCode(),
  ]);

  return (
    <div className="space-y-6">
      {/* 페이지 타이틀 */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">설정</h1>
        <p className="text-gray-600">챗봇 연동 및 위젯 설정을 관리하세요.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* 카카오 연동 설정 */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">카카오톡 연동</h2>
            <p className="mt-1 text-sm text-gray-500">
              카카오 오픈빌더와 연동하여 카카오톡에서 챗봇을 사용하세요.
            </p>
          </div>
          <KakaoSettingsForm
            initialData={{
              botId: settings?.kakaoBotId || '',
              maxResponseLength: settings?.kakaoMaxResponseLength || 300,
              welcomeMessage: settings?.kakaoWelcomeMessage || '',
            }}
          />
        </div>

        {/* 위젯 설정 */}
        <div className="rounded-lg border bg-white p-6">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-gray-900">웹 위젯 설정</h2>
            <p className="mt-1 text-sm text-gray-500">
              웹사이트에 삽입할 챗봇 위젯의 외관을 설정하세요.
            </p>
          </div>
          <WidgetSettingsForm
            initialData={{
              primaryColor: settings?.widgetPrimaryColor || '#3B82F6',
              title: settings?.widgetTitle || '무엇을 도와드릴까요?',
              subtitle: settings?.widgetSubtitle || '질문을 입력해주세요',
              placeholder: settings?.widgetPlaceholder || '메시지를 입력하세요...',
            }}
          />
        </div>
      </div>

      {/* 임베드 코드 */}
      <div className="rounded-lg border bg-white p-6">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900">위젯 설치 코드</h2>
          <p className="mt-1 text-sm text-gray-500">
            아래 코드를 웹사이트의 &lt;head&gt; 또는 &lt;body&gt; 태그에 추가하세요.
          </p>
        </div>
        <EmbedCodeSection code={embedCode || ''} />
      </div>
    </div>
  );
}
