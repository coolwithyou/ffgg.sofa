/* eslint-disable no-console */
/**
 * 사용자 비밀번호 리셋 스크립트
 *
 * 사용법:
 *   pnpm admin:reset-password
 *
 * 또는 환경변수로 직접 지정:
 *   RESET_EMAIL=user@example.com RESET_PASSWORD=NewPass123! pnpm admin:reset-password
 */

import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import * as readline from 'readline';
import * as schema from '../drizzle/schema';

// 환경변수 로드
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const { users } = schema;

// 비밀번호 숨김 입력을 위한 함수
function createHiddenInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    // stdin을 raw 모드로 설정하여 입력을 숨김
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    process.stdout.write(prompt);

    let password = '';
    const onData = (char: Buffer) => {
      const c = char.toString('utf8');

      switch (c) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl+D
          process.stdin.removeListener('data', onData);
          if (process.stdin.isTTY) {
            process.stdin.setRawMode(false);
          }
          process.stdout.write('\n');
          rl.close();
          resolve(password);
          break;
        case '\u0003': // Ctrl+C
          process.stdout.write('\n');
          process.exit(0);
          break;
        case '\u007F': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            process.stdout.write('\b \b');
          }
          break;
        default:
          password += c;
          process.stdout.write('*');
          break;
      }
    };

    process.stdin.on('data', onData);
    process.stdin.resume();
  });
}

// 일반 입력 함수
function createInput(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// 비밀번호 검증
function validatePassword(password: string): { valid: boolean; error?: string } {
  if (password.length < 8) {
    return { valid: false, error: '비밀번호는 8자 이상이어야 합니다.' };
  }
  if (!/[A-Za-z]/.test(password)) {
    return { valid: false, error: '비밀번호에 영문자를 포함해야 합니다.' };
  }
  if (!/\d/.test(password)) {
    return { valid: false, error: '비밀번호에 숫자를 포함해야 합니다.' };
  }
  if (!/[@$!%*#?&]/.test(password)) {
    return { valid: false, error: '비밀번호에 특수문자(@$!%*#?&)를 포함해야 합니다.' };
  }
  return { valid: true };
}

async function resetPassword() {
  console.log('');
  console.log('========================================');
  console.log('  SOFA - 사용자 비밀번호 리셋');
  console.log('========================================');
  console.log('');

  // 환경변수 확인
  if (!process.env.DATABASE_URL) {
    console.error('ERROR: DATABASE_URL 환경변수가 설정되지 않았습니다.');
    console.error('       .env.local 파일에 DATABASE_URL을 설정해주세요.');
    process.exit(1);
  }

  try {
    // DB 연결
    const client = postgres(process.env.DATABASE_URL!, { ssl: 'require' });
    const db = drizzle(client, { schema });

    // 이메일 입력 (환경변수 또는 프롬프트)
    let email = process.env.RESET_EMAIL;
    if (!email) {
      email = await createInput('사용자 이메일: ');
    } else {
      console.log(`사용자 이메일: ${email}`);
    }

    if (!email) {
      console.error('ERROR: 이메일을 입력해주세요.');
      process.exit(1);
    }

    // 사용자 확인
    const existingUser = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });

    if (!existingUser) {
      console.error(`ERROR: ${email} 이메일로 등록된 사용자를 찾을 수 없습니다.`);
      process.exit(1);
    }

    console.log('');
    console.log(`사용자 정보:`);
    console.log(`  ID: ${existingUser.id}`);
    console.log(`  역할: ${existingUser.role}`);
    console.log(`  마지막 로그인: ${existingUser.lastLoginAt?.toISOString() || '없음'}`);
    console.log('');

    // 새 비밀번호 입력 (환경변수 또는 프롬프트)
    let newPassword = process.env.RESET_PASSWORD;
    if (!newPassword) {
      console.log('비밀번호 요구사항:');
      console.log('  - 8자 이상');
      console.log('  - 영문자 포함');
      console.log('  - 숫자 포함');
      console.log('  - 특수문자(@$!%*#?&) 포함');
      console.log('');

      newPassword = await createHiddenInput('새 비밀번호: ');

      // 비밀번호 확인
      const confirmPassword = await createHiddenInput('비밀번호 확인: ');

      if (newPassword !== confirmPassword) {
        console.error('ERROR: 비밀번호가 일치하지 않습니다.');
        process.exit(1);
      }
    }

    // 비밀번호 검증
    const validation = validatePassword(newPassword);
    if (!validation.valid) {
      console.error(`ERROR: ${validation.error}`);
      process.exit(1);
    }

    // 비밀번호 해시
    console.log('');
    console.log('비밀번호 변경 중...');
    const passwordHash = await bcrypt.hash(newPassword, 12);

    // 업데이트
    await db
      .update(users)
      .set({
        passwordHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
        failedLoginCount: 0,
        lockedUntil: null,
      })
      .where(eq(users.email, email));

    console.log('');
    console.log('========================================');
    console.log('  비밀번호 변경 완료!');
    console.log('========================================');
    console.log('');
    console.log(`이메일: ${email}`);
    console.log('새 비밀번호로 로그인할 수 있습니다.');
    console.log('');

    await client.end();
    process.exit(0);
  } catch (error) {
    console.error('비밀번호 변경 중 오류 발생:', error);
    process.exit(1);
  }
}

resetPassword();
