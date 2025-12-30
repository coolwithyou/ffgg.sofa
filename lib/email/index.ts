/**
 * 이메일 발송 모듈
 * Resend API를 사용한 이메일 발송
 * [Week 12] 런칭 준비
 */

import { Resend } from 'resend';

// Resend 클라이언트 초기화
const resend = new Resend(process.env.RESEND_API_KEY);

// 발신자 이메일 (Resend에서 인증된 도메인 필요)
const FROM_EMAIL = process.env.EMAIL_FROM || 'SOFA <noreply@sofa.app>';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface SendEmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * 기본 이메일 발송 함수
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<SendEmailResult> {
  // 개발 환경에서 API 키가 없으면 로그만 출력
  if (!process.env.RESEND_API_KEY) {
    console.warn('[EMAIL] RESEND_API_KEY가 설정되지 않았습니다. 이메일 발송을 건너뜁니다.');
    console.log('[EMAIL] 발송 예정:', { to, subject });
    return { success: true, messageId: 'dev-mode-skipped' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject,
      html,
      text: text || htmlToText(html),
    });

    if (error) {
      console.error('[EMAIL] 발송 실패:', error);
      return { success: false, error: error.message };
    }

    console.log('[EMAIL] 발송 성공:', data?.id);
    return { success: true, messageId: data?.id };
  } catch (err) {
    const error = err instanceof Error ? err.message : 'Unknown error';
    console.error('[EMAIL] 발송 중 오류:', error);
    return { success: false, error };
  }
}

/**
 * 이메일 인증 메일 발송
 */
export async function sendVerificationEmail({
  to,
  token,
  userName,
}: {
  to: string;
  token: string;
  userName?: string;
}): Promise<SendEmailResult> {
  const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
  const name = userName || '고객';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">기업용 RAG 챗봇 서비스</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">안녕하세요, ${name}님!</h2>

    <p>SOFA 서비스에 가입해 주셔서 감사합니다.</p>
    <p>아래 버튼을 클릭하여 이메일 인증을 완료해 주세요.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">이메일 인증하기</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verifyUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      이 링크는 24시간 동안 유효합니다.<br>
      본인이 요청하지 않은 이메일이라면 무시해 주세요.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: '[SOFA] 이메일 인증을 완료해 주세요',
    html,
  });
}

/**
 * 비밀번호 재설정 메일 발송
 */
export async function sendPasswordResetEmail({
  to,
  token,
  userName,
}: {
  to: string;
  token: string;
  userName?: string;
}): Promise<SendEmailResult> {
  const resetUrl = `${APP_URL}/reset-password?token=${token}`;
  const name = userName || '고객';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">기업용 RAG 챗봇 서비스</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">안녕하세요, ${name}님!</h2>

    <p>비밀번호 재설정 요청이 접수되었습니다.</p>
    <p>아래 버튼을 클릭하여 새 비밀번호를 설정해 주세요.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${resetUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">비밀번호 재설정</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${resetUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>보안 안내:</strong> 본인이 요청하지 않은 경우, 즉시 비밀번호를 변경하고 고객센터에 문의해 주세요.
      </p>
    </div>

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      이 링크는 1시간 동안 유효합니다.<br>
      링크가 만료된 경우 비밀번호 찾기를 다시 진행해 주세요.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: '[SOFA] 비밀번호 재설정 안내',
    html,
  });
}

/**
 * 환영 이메일 발송 (가입 완료 후)
 */
export async function sendWelcomeEmail({
  to,
  userName,
  companyName,
}: {
  to: string;
  userName?: string;
  companyName?: string;
}): Promise<SendEmailResult> {
  const name = userName || '고객';
  const company = companyName || '귀사';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">기업용 RAG 챗봇 서비스</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">환영합니다, ${name}님!</h2>

    <p>${company}의 SOFA 가입을 축하드립니다.</p>
    <p>이제 14일 무료 체험을 시작하실 수 있습니다.</p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">시작하기</h3>
      <ul style="color: #4b5563; margin: 0; padding-left: 20px;">
        <li>문서를 업로드하여 챗봇 학습시키기</li>
        <li>웹 위젯으로 사이트에 챗봇 설치하기</li>
        <li>카카오톡 채널과 연동하기</li>
      </ul>
    </div>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/dashboard" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">대시보드로 이동</a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <p style="color: #6b7280; font-size: 14px;">
      도움이 필요하시면 언제든 문의해 주세요.<br>
      support@sofa.app
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: '[SOFA] 가입을 환영합니다!',
    html,
  });
}

/**
 * 이메일 변경 인증 메일 발송
 */
export async function sendEmailChangeVerification({
  to,
  token,
  userName,
  oldEmail,
}: {
  to: string;
  token: string;
  userName?: string;
  oldEmail: string;
}): Promise<SendEmailResult> {
  const verifyUrl = `${APP_URL}/verify-email-change?token=${token}`;
  const name = userName || '고객';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">기업용 RAG 챗봇 서비스</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">안녕하세요, ${name}님!</h2>

    <p>새 이메일 주소(${to})로 변경 요청이 접수되었습니다.</p>
    <p>아래 버튼을 클릭하여 이메일 변경을 완료해 주세요.</p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${verifyUrl}" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">이메일 변경 확인</a>
    </div>

    <p style="color: #6b7280; font-size: 14px;">버튼이 작동하지 않으면 아래 링크를 브라우저에 붙여넣어 주세요:</p>
    <p style="color: #6b7280; font-size: 12px; word-break: break-all;">${verifyUrl}</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>보안 안내:</strong> 본인이 요청하지 않은 경우, 이 이메일을 무시하시고 기존 이메일(${oldEmail})로 계속 로그인하세요.
      </p>
    </div>

    <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
      이 링크는 24시간 동안 유효합니다.<br>
      링크가 만료된 경우 이메일 변경을 다시 요청해 주세요.
    </p>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: '[SOFA] 새 이메일 주소 인증',
    html,
  });
}

/**
 * 이메일 변경 알림 발송 (기존 이메일로)
 */
export async function sendEmailChangeNotification({
  to,
  newEmail,
  userName,
}: {
  to: string;
  newEmail: string;
  userName?: string;
}): Promise<SendEmailResult> {
  const name = userName || '고객';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">기업용 RAG 챗봇 서비스</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <h2 style="color: #1f2937; margin-top: 0;">안녕하세요, ${name}님!</h2>

    <p>계정의 이메일 주소가 변경되었음을 알려드립니다.</p>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <p style="margin: 0; color: #4b5563;">
        <strong>새 이메일 주소:</strong> ${newEmail}
      </p>
    </div>

    <p>앞으로는 새 이메일 주소로 로그인해 주세요.</p>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="color: #92400e; margin: 0; font-size: 14px;">
        <strong>보안 안내:</strong> 본인이 변경하지 않은 경우, 즉시 고객센터(support@sofa.app)로 연락해 주세요.
      </p>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: '[SOFA] 이메일 주소가 변경되었습니다',
    html,
  });
}

/**
 * 예산 알림 이메일 발송
 */
export async function sendBudgetAlertEmail({
  to,
  tenantName,
  alertType,
  currentUsage,
  budgetLimit,
  percentUsed,
}: {
  to: string;
  tenantName: string;
  alertType: 'warning' | 'critical' | 'exceeded';
  currentUsage: number;
  budgetLimit: number;
  percentUsed: number;
}): Promise<SendEmailResult> {
  const alertConfig = {
    warning: {
      emoji: '⚠️',
      title: '예산 경고',
      color: '#FF9800',
      bgColor: '#FFF3E0',
      borderColor: '#FF9800',
    },
    critical: {
      emoji: '🚨',
      title: '예산 위험',
      color: '#F44336',
      bgColor: '#FFEBEE',
      borderColor: '#F44336',
    },
    exceeded: {
      emoji: '🚨',
      title: '예산 초과',
      color: '#D32F2F',
      bgColor: '#FFCDD2',
      borderColor: '#D32F2F',
    },
  };

  const config = alertConfig[alertType];
  const progressWidth = Math.min(percentUsed, 100);

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI 사용량 알림</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: ${config.bgColor}; border: 1px solid ${config.borderColor}; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: ${config.color}; margin: 0 0 10px 0; font-size: 20px;">${config.emoji} ${config.title}</h2>
      <p style="color: ${config.color}; margin: 0;">테넌트: <strong>${tenantName}</strong></p>
    </div>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">현재 사용량</h3>
      <p style="font-size: 24px; font-weight: bold; color: #1f2937; margin: 10px 0;">
        $${currentUsage.toFixed(2)} / $${budgetLimit.toFixed(2)}
      </p>
      <div style="background: #e5e7eb; border-radius: 4px; height: 8px; margin: 10px 0;">
        <div style="background: ${config.color}; border-radius: 4px; height: 8px; width: ${progressWidth}%;"></div>
      </div>
      <p style="color: #6b7280; margin: 0; font-size: 14px;">${percentUsed.toFixed(1)}% 사용</p>
    </div>

    <p style="color: #4b5563;">
      ${alertType === 'exceeded' ? '예산을 초과하였습니다. 추가 비용이 발생할 수 있습니다.' : '예산 한도에 도달하기 전에 사용량을 검토해 주세요.'}
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/admin/usage" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">사용량 대시보드 보기</a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: `[SOFA] ${config.emoji} ${tenantName} - ${config.title} (${percentUsed.toFixed(1)}%)`,
    html,
  });
}

/**
 * 이상 사용량 알림 이메일 발송
 */
export async function sendAnomalyAlertEmail({
  to,
  tenantName,
  todayCost,
  yesterdayCost,
  increaseRatio,
}: {
  to: string;
  tenantName: string;
  todayCost: number;
  yesterdayCost: number;
  increaseRatio: number;
}): Promise<SendEmailResult> {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
    <h1 style="color: white; margin: 0; font-size: 28px;">SOFA</h1>
    <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI 사용량 알림</p>
  </div>

  <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none;">
    <div style="background: #FFF3E0; border: 1px solid #FF9800; border-radius: 8px; padding: 20px; margin-bottom: 20px;">
      <h2 style="color: #E65100; margin: 0 0 10px 0; font-size: 20px;">📈 비정상 사용량 감지</h2>
      <p style="color: #E65100; margin: 0;">테넌트: <strong>${tenantName}</strong></p>
    </div>

    <div style="background: #f9fafb; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h3 style="color: #1f2937; margin-top: 0; font-size: 16px;">사용량 비교</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">어제 비용</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold;">$${yesterdayCost.toFixed(2)}</td>
        </tr>
        <tr>
          <td style="padding: 10px 0; color: #6b7280;">오늘 비용</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; color: #E65100;">$${todayCost.toFixed(2)}</td>
        </tr>
        <tr style="border-top: 1px solid #e5e7eb;">
          <td style="padding: 10px 0; color: #6b7280;">증가율</td>
          <td style="padding: 10px 0; text-align: right; font-weight: bold; font-size: 18px; color: #D32F2F;">+${increaseRatio.toFixed(0)}%</td>
        </tr>
      </table>
    </div>

    <p style="color: #4b5563;">
      전일 대비 사용량이 급증하였습니다. 비정상적인 사용이 아닌지 확인해 주세요.
    </p>

    <div style="text-align: center; margin: 30px 0;">
      <a href="${APP_URL}/admin/usage" style="display: inline-block; background: #f97316; color: white; text-decoration: none; padding: 14px 30px; border-radius: 8px; font-weight: 600; font-size: 16px;">사용량 대시보드 보기</a>
    </div>
  </div>

  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>&copy; 2024 SOFA. All rights reserved.</p>
  </div>
</body>
</html>
  `;

  return sendEmail({
    to,
    subject: `[SOFA] 📈 ${tenantName} - 비정상 사용량 감지 (+${increaseRatio.toFixed(0)}%)`,
    html,
  });
}

/**
 * HTML을 텍스트로 간단 변환 (폴백용)
 */
function htmlToText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
