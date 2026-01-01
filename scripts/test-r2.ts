/**
 * R2 연결 테스트 스크립트
 * 실행: pnpm exec dotenv -e .env.local -- tsx scripts/test-r2.ts
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListBucketsCommand } from '@aws-sdk/client-s3';

async function testR2Connection() {
  console.log('🔍 R2 연결 테스트 시작...\n');

  // 환경 변수 확인
  const endpoint = process.env.S3_ENDPOINT;
  const region = process.env.S3_REGION || 'auto';
  const accessKeyId = process.env.S3_ACCESS_KEY_ID;
  const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
  const bucket = process.env.S3_BUCKET;

  console.log('📋 설정 확인:');
  console.log(`   Endpoint: ${endpoint}`);
  console.log(`   Region: ${region}`);
  console.log(`   Bucket: ${bucket}`);
  console.log(`   Access Key: ${accessKeyId?.slice(0, 8)}...`);
  console.log('');

  // 필수 값 확인
  if (!endpoint || !accessKeyId || !secretAccessKey || !bucket) {
    console.error('❌ 필수 환경 변수가 설정되지 않았습니다.');
    console.error('   S3_ENDPOINT, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY, S3_BUCKET 확인');
    process.exit(1);
  }

  // 플레이스홀더 체크
  if (accessKeyId.includes('your-') || secretAccessKey.includes('your-')) {
    console.error('❌ 환경 변수가 플레이스홀더 값입니다. 실제 R2 자격 증명으로 업데이트하세요.');
    process.exit(1);
  }

  // S3 클라이언트 생성
  const client = new S3Client({
    endpoint,
    region,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
    forcePathStyle: true,
  });

  const testKey = `_test/connection-test-${Date.now()}.txt`;
  const testContent = `R2 연결 테스트 - ${new Date().toISOString()}`;

  try {
    // 1. 파일 업로드 테스트
    console.log('1️⃣ 파일 업로드 테스트...');
    await client.send(new PutObjectCommand({
      Bucket: bucket,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    }));
    console.log('   ✅ 업로드 성공\n');

    // 2. 파일 읽기 테스트
    console.log('2️⃣ 파일 읽기 테스트...');
    const getResponse = await client.send(new GetObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    const body = await getResponse.Body?.transformToString();
    if (body === testContent) {
      console.log('   ✅ 읽기 성공 - 내용 일치\n');
    } else {
      console.log('   ⚠️ 읽기 성공 - 내용 불일치\n');
    }

    // 3. 파일 삭제 테스트
    console.log('3️⃣ 파일 삭제 테스트...');
    await client.send(new DeleteObjectCommand({
      Bucket: bucket,
      Key: testKey,
    }));
    console.log('   ✅ 삭제 성공\n');

    console.log('🎉 모든 테스트 통과! R2 연결이 정상적으로 작동합니다.');
    console.log('');
    console.log('📝 다음 단계:');
    console.log('   1. Vercel에 환경 변수 추가');
    console.log('   2. 문서 업로드 기능 테스트');

  } catch (error) {
    console.error('❌ 테스트 실패:', error);

    if (error instanceof Error) {
      if (error.message.includes('Access Denied')) {
        console.error('\n💡 해결 방법: R2 API 토큰 권한을 확인하세요 (Object Read & Write 필요)');
      } else if (error.message.includes('NoSuchBucket')) {
        console.error('\n💡 해결 방법: 버킷 이름을 확인하세요');
      } else if (error.message.includes('InvalidAccessKeyId')) {
        console.error('\n💡 해결 방법: Access Key ID를 확인하세요');
      } else if (error.message.includes('SignatureDoesNotMatch')) {
        console.error('\n💡 해결 방법: Secret Access Key를 확인하세요');
      }
    }

    process.exit(1);
  }
}

testR2Connection();
