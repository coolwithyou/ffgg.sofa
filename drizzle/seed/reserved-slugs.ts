/**
 * 예약 슬러그 시드 데이터
 * 사용자가 등록할 수 없는 슬러그 블랙리스트
 *
 * 카테고리:
 * - profanity: 비속어, 욕설 (한국어 로마자 표기 + 영어)
 * - brand: 브랜드명, 상표 (IT 기업, SaaS, SNS)
 * - premium: 가치 높은 키워드 (짧고 직관적인 단어)
 * - system: 시스템 예약어 (경로, 기술 용어)
 * - other: 기타 (스팸, 역할, 보안)
 *
 * 사용법:
 *   pnpm tsx drizzle/seed/reserved-slugs.ts
 */

import { db } from '@/lib/db';
import { reservedSlugs } from '../schema';
import { eq } from 'drizzle-orm';

type Category = 'profanity' | 'brand' | 'premium' | 'system' | 'other';

interface ReservedSlugSeed {
  slug: string;
  category: Category;
  reason?: string;
}

/**
 * 비속어/욕설 키워드
 * 한국어 로마자 표기 + 영어 비속어
 */
const profanitySlugs: ReservedSlugSeed[] = [
  // 한국어 비속어 (로마자 표기)
  { slug: 'sibal', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'ssibal', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'shibal', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'tlqkf', category: 'profanity', reason: '한국어 비속어 (키보드 변환)' },
  { slug: 'gaesaekki', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'gaesakki', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'byungshin', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'byeongsin', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'jiral', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'jot', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'jonna', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'boji', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'ssip', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'nyeon', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'nom', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'michin', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'nimi', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'seki', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'saekki', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'sekki', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'gae', category: 'profanity', reason: '한국어 비속어 접두사' },
  { slug: 'niga', category: 'profanity', reason: '한국어 비속어/오해 소지' },
  { slug: 'nigga', category: 'profanity', reason: '영어 비속어' },
  { slug: 'jaji', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'dak', category: 'profanity', reason: '한국어 비속어' },
  { slug: 'dakcheo', category: 'profanity', reason: '한국어 비속어' },
  // 영어 비속어
  { slug: 'fuck', category: 'profanity', reason: '영어 비속어' },
  { slug: 'fucking', category: 'profanity', reason: '영어 비속어' },
  { slug: 'fucker', category: 'profanity', reason: '영어 비속어' },
  { slug: 'fck', category: 'profanity', reason: '영어 비속어 변형' },
  { slug: 'shit', category: 'profanity', reason: '영어 비속어' },
  { slug: 'shitty', category: 'profanity', reason: '영어 비속어' },
  { slug: 'ass', category: 'profanity', reason: '영어 비속어' },
  { slug: 'asshole', category: 'profanity', reason: '영어 비속어' },
  { slug: 'bitch', category: 'profanity', reason: '영어 비속어' },
  { slug: 'damn', category: 'profanity', reason: '영어 비속어' },
  { slug: 'dick', category: 'profanity', reason: '영어 비속어' },
  { slug: 'cock', category: 'profanity', reason: '영어 비속어' },
  { slug: 'pussy', category: 'profanity', reason: '영어 비속어' },
  { slug: 'cunt', category: 'profanity', reason: '영어 비속어' },
  { slug: 'bastard', category: 'profanity', reason: '영어 비속어' },
  { slug: 'whore', category: 'profanity', reason: '영어 비속어' },
  { slug: 'slut', category: 'profanity', reason: '영어 비속어' },
  { slug: 'porn', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'porno', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'sex', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'sexy', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'xxx', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'nude', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'naked', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'hentai', category: 'profanity', reason: '성인 콘텐츠' },
  { slug: 'kill', category: 'profanity', reason: '폭력적 표현' },
  { slug: 'murder', category: 'profanity', reason: '폭력적 표현' },
  { slug: 'suicide', category: 'profanity', reason: '민감한 주제' },
  { slug: 'nazi', category: 'profanity', reason: '혐오 표현' },
  { slug: 'hitler', category: 'profanity', reason: '혐오 표현' },
];

/**
 * 브랜드명/상표 키워드
 * IT 기업, SaaS, SNS 브랜드
 */
const brandSlugs: ReservedSlugSeed[] = [
  // 글로벌 IT 기업
  { slug: 'google', category: 'brand', reason: 'Google 상표' },
  { slug: 'apple', category: 'brand', reason: 'Apple 상표' },
  { slug: 'microsoft', category: 'brand', reason: 'Microsoft 상표' },
  { slug: 'amazon', category: 'brand', reason: 'Amazon 상표' },
  { slug: 'meta', category: 'brand', reason: 'Meta 상표' },
  { slug: 'facebook', category: 'brand', reason: 'Facebook 상표' },
  { slug: 'instagram', category: 'brand', reason: 'Instagram 상표' },
  { slug: 'twitter', category: 'brand', reason: 'Twitter 상표' },
  { slug: 'netflix', category: 'brand', reason: 'Netflix 상표' },
  { slug: 'youtube', category: 'brand', reason: 'YouTube 상표' },
  { slug: 'tiktok', category: 'brand', reason: 'TikTok 상표' },
  { slug: 'linkedin', category: 'brand', reason: 'LinkedIn 상표' },
  { slug: 'github', category: 'brand', reason: 'GitHub 상표' },
  { slug: 'gitlab', category: 'brand', reason: 'GitLab 상표' },
  { slug: 'slack', category: 'brand', reason: 'Slack 상표' },
  { slug: 'discord', category: 'brand', reason: 'Discord 상표' },
  { slug: 'notion', category: 'brand', reason: 'Notion 상표' },
  { slug: 'figma', category: 'brand', reason: 'Figma 상표' },
  { slug: 'vercel', category: 'brand', reason: 'Vercel 상표' },
  { slug: 'nextjs', category: 'brand', reason: 'Next.js 상표' },
  { slug: 'react', category: 'brand', reason: 'React 상표' },
  { slug: 'stripe', category: 'brand', reason: 'Stripe 상표' },
  { slug: 'paypal', category: 'brand', reason: 'PayPal 상표' },
  { slug: 'zoom', category: 'brand', reason: 'Zoom 상표' },
  { slug: 'teams', category: 'brand', reason: 'Microsoft Teams 상표' },
  { slug: 'dropbox', category: 'brand', reason: 'Dropbox 상표' },
  { slug: 'shopify', category: 'brand', reason: 'Shopify 상표' },
  { slug: 'salesforce', category: 'brand', reason: 'Salesforce 상표' },
  { slug: 'hubspot', category: 'brand', reason: 'HubSpot 상표' },
  { slug: 'asana', category: 'brand', reason: 'Asana 상표' },
  { slug: 'trello', category: 'brand', reason: 'Trello 상표' },
  { slug: 'jira', category: 'brand', reason: 'Jira 상표' },
  { slug: 'atlassian', category: 'brand', reason: 'Atlassian 상표' },
  { slug: 'twilio', category: 'brand', reason: 'Twilio 상표' },
  { slug: 'sendgrid', category: 'brand', reason: 'SendGrid 상표' },
  { slug: 'mailchimp', category: 'brand', reason: 'Mailchimp 상표' },
  { slug: 'intercom', category: 'brand', reason: 'Intercom 상표' },
  { slug: 'zendesk', category: 'brand', reason: 'Zendesk 상표' },
  // AI 기업
  { slug: 'openai', category: 'brand', reason: 'OpenAI 상표' },
  { slug: 'anthropic', category: 'brand', reason: 'Anthropic 상표' },
  { slug: 'claude', category: 'brand', reason: 'Claude (Anthropic) 상표' },
  { slug: 'chatgpt', category: 'brand', reason: 'ChatGPT 상표' },
  { slug: 'gpt', category: 'brand', reason: 'GPT 상표' },
  { slug: 'gpt4', category: 'brand', reason: 'GPT-4 상표' },
  { slug: 'gpt5', category: 'brand', reason: 'GPT-5 상표' },
  { slug: 'gemini', category: 'brand', reason: 'Gemini (Google) 상표' },
  { slug: 'bard', category: 'brand', reason: 'Bard (Google) 상표' },
  { slug: 'copilot', category: 'brand', reason: 'Copilot 상표' },
  { slug: 'midjourney', category: 'brand', reason: 'Midjourney 상표' },
  { slug: 'stablediffusion', category: 'brand', reason: 'Stable Diffusion 상표' },
  { slug: 'stability', category: 'brand', reason: 'Stability AI 상표' },
  { slug: 'huggingface', category: 'brand', reason: 'Hugging Face 상표' },
  { slug: 'replicate', category: 'brand', reason: 'Replicate 상표' },
  { slug: 'cohere', category: 'brand', reason: 'Cohere 상표' },
  { slug: 'perplexity', category: 'brand', reason: 'Perplexity 상표' },
  // 한국 기업
  { slug: 'naver', category: 'brand', reason: 'Naver 상표' },
  { slug: 'kakao', category: 'brand', reason: 'Kakao 상표' },
  { slug: 'kakaotalk', category: 'brand', reason: 'KakaoTalk 상표' },
  { slug: 'line', category: 'brand', reason: 'LINE 상표' },
  { slug: 'samsung', category: 'brand', reason: 'Samsung 상표' },
  { slug: 'lg', category: 'brand', reason: 'LG 상표' },
  { slug: 'hyundai', category: 'brand', reason: 'Hyundai 상표' },
  { slug: 'coupang', category: 'brand', reason: 'Coupang 상표' },
  { slug: 'woowa', category: 'brand', reason: '우아한형제들 상표' },
  { slug: 'baemin', category: 'brand', reason: '배달의민족 상표' },
  { slug: 'toss', category: 'brand', reason: 'Toss 상표' },
  { slug: 'viva', category: 'brand', reason: 'Viva Republica 상표' },
  { slug: '당근', category: 'brand', reason: '당근마켓 상표' },
  { slug: 'daangn', category: 'brand', reason: '당근마켓 상표' },
  { slug: 'karrot', category: 'brand', reason: '당근마켓 상표' },
  { slug: 'zigbang', category: 'brand', reason: '직방 상표' },
  { slug: 'yanolja', category: 'brand', reason: '야놀자 상표' },
  { slug: 'musinsa', category: 'brand', reason: '무신사 상표' },
  { slug: 'kurly', category: 'brand', reason: '컬리 상표' },
  { slug: 'watcha', category: 'brand', reason: '왓챠 상표' },
  { slug: 'ridi', category: 'brand', reason: '리디 상표' },
  // 플랫폼/서비스
  { slug: 'aws', category: 'brand', reason: 'AWS 상표' },
  { slug: 'azure', category: 'brand', reason: 'Azure 상표' },
  { slug: 'gcp', category: 'brand', reason: 'GCP 상표' },
  { slug: 'cloudflare', category: 'brand', reason: 'Cloudflare 상표' },
  { slug: 'heroku', category: 'brand', reason: 'Heroku 상표' },
  { slug: 'digitalocean', category: 'brand', reason: 'DigitalOcean 상표' },
  { slug: 'supabase', category: 'brand', reason: 'Supabase 상표' },
  { slug: 'firebase', category: 'brand', reason: 'Firebase 상표' },
  { slug: 'mongodb', category: 'brand', reason: 'MongoDB 상표' },
  { slug: 'postgresql', category: 'brand', reason: 'PostgreSQL 상표' },
  { slug: 'redis', category: 'brand', reason: 'Redis 상표' },
  { slug: 'elasticsearch', category: 'brand', reason: 'Elasticsearch 상표' },
  // SOFA 경쟁사 및 유사 서비스
  { slug: 'typebot', category: 'brand', reason: 'Typebot 상표' },
  { slug: 'botpress', category: 'brand', reason: 'Botpress 상표' },
  { slug: 'rasa', category: 'brand', reason: 'Rasa 상표' },
  { slug: 'dialogflow', category: 'brand', reason: 'Dialogflow 상표' },
  { slug: 'voiceflow', category: 'brand', reason: 'Voiceflow 상표' },
  { slug: 'dify', category: 'brand', reason: 'Dify 상표' },
  { slug: 'flowise', category: 'brand', reason: 'Flowise 상표' },
  { slug: 'langchain', category: 'brand', reason: 'LangChain 상표' },
  { slug: 'llamaindex', category: 'brand', reason: 'LlamaIndex 상표' },
];

/**
 * 가치 높은 프리미엄 키워드
 * 짧고 직관적인 단어들
 */
const premiumSlugs: ReservedSlugSeed[] = [
  // AI/Tech 관련
  { slug: 'ai', category: 'premium', reason: '인기 키워드' },
  { slug: 'bot', category: 'premium', reason: '인기 키워드' },
  { slug: 'chat', category: 'premium', reason: '인기 키워드' },
  { slug: 'chatbot', category: 'premium', reason: '인기 키워드' },
  { slug: 'ask', category: 'premium', reason: '인기 키워드' },
  { slug: 'help', category: 'premium', reason: '인기 키워드' },
  { slug: 'support', category: 'premium', reason: '인기 키워드' },
  { slug: 'faq', category: 'premium', reason: '인기 키워드' },
  { slug: 'qa', category: 'premium', reason: '인기 키워드' },
  { slug: 'llm', category: 'premium', reason: '인기 키워드' },
  { slug: 'ml', category: 'premium', reason: '인기 키워드' },
  { slug: 'api', category: 'premium', reason: '인기 키워드' },
  { slug: 'sdk', category: 'premium', reason: '인기 키워드' },
  { slug: 'app', category: 'premium', reason: '인기 키워드' },
  { slug: 'web', category: 'premium', reason: '인기 키워드' },
  { slug: 'dev', category: 'premium', reason: '인기 키워드' },
  { slug: 'code', category: 'premium', reason: '인기 키워드' },
  { slug: 'docs', category: 'premium', reason: '인기 키워드' },
  { slug: 'blog', category: 'premium', reason: '인기 키워드' },
  { slug: 'news', category: 'premium', reason: '인기 키워드' },
  { slug: 'shop', category: 'premium', reason: '인기 키워드' },
  { slug: 'store', category: 'premium', reason: '인기 키워드' },
  // 일반 인기 단어
  { slug: 'pro', category: 'premium', reason: '인기 키워드' },
  { slug: 'plus', category: 'premium', reason: '인기 키워드' },
  { slug: 'vip', category: 'premium', reason: '인기 키워드' },
  { slug: 'premium', category: 'premium', reason: '인기 키워드' },
  { slug: 'official', category: 'premium', reason: '인기 키워드' },
  { slug: 'team', category: 'premium', reason: '인기 키워드' },
  { slug: 'about', category: 'premium', reason: '인기 키워드' },
  { slug: 'contact', category: 'premium', reason: '인기 키워드' },
  { slug: 'info', category: 'premium', reason: '인기 키워드' },
  { slug: 'hello', category: 'premium', reason: '인기 키워드' },
  { slug: 'hi', category: 'premium', reason: '인기 키워드' },
  { slug: 'hey', category: 'premium', reason: '인기 키워드' },
  { slug: 'me', category: 'premium', reason: '인기 키워드' },
  { slug: 'my', category: 'premium', reason: '인기 키워드' },
  { slug: 'i', category: 'premium', reason: '인기 키워드' },
  { slug: 'you', category: 'premium', reason: '인기 키워드' },
  { slug: 'we', category: 'premium', reason: '인기 키워드' },
  { slug: 'us', category: 'premium', reason: '인기 키워드' },
  { slug: 'home', category: 'premium', reason: '인기 키워드' },
  { slug: 'main', category: 'premium', reason: '인기 키워드' },
  { slug: 'new', category: 'premium', reason: '인기 키워드' },
  { slug: 'best', category: 'premium', reason: '인기 키워드' },
  { slug: 'top', category: 'premium', reason: '인기 키워드' },
  { slug: 'hot', category: 'premium', reason: '인기 키워드' },
  { slug: 'cool', category: 'premium', reason: '인기 키워드' },
  { slug: 'good', category: 'premium', reason: '인기 키워드' },
  { slug: 'great', category: 'premium', reason: '인기 키워드' },
  { slug: 'free', category: 'premium', reason: '인기 키워드' },
  { slug: 'open', category: 'premium', reason: '인기 키워드' },
  { slug: 'public', category: 'premium', reason: '인기 키워드' },
  { slug: 'private', category: 'premium', reason: '인기 키워드' },
  { slug: 'test', category: 'premium', reason: '인기 키워드' },
  { slug: 'demo', category: 'premium', reason: '인기 키워드' },
  { slug: 'example', category: 'premium', reason: '인기 키워드' },
  { slug: 'sample', category: 'premium', reason: '인기 키워드' },
  // 한글 인기 단어
  { slug: '공식', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '고객센터', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '문의', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '지원', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '도움말', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '안내', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '소개', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '블로그', category: 'premium', reason: '한글 인기 키워드' },
  { slug: '뉴스', category: 'premium', reason: '한글 인기 키워드' },
];

/**
 * 시스템 예약어
 * 경로, 기술 용어, 시스템 키워드
 */
const systemSlugs: ReservedSlugSeed[] = [
  // 시스템 경로
  { slug: 'admin', category: 'system', reason: '시스템 경로' },
  { slug: 'administrator', category: 'system', reason: '시스템 경로' },
  { slug: 'login', category: 'system', reason: '시스템 경로' },
  { slug: 'logout', category: 'system', reason: '시스템 경로' },
  { slug: 'signin', category: 'system', reason: '시스템 경로' },
  { slug: 'signout', category: 'system', reason: '시스템 경로' },
  { slug: 'signup', category: 'system', reason: '시스템 경로' },
  { slug: 'register', category: 'system', reason: '시스템 경로' },
  { slug: 'auth', category: 'system', reason: '시스템 경로' },
  { slug: 'oauth', category: 'system', reason: '시스템 경로' },
  { slug: 'callback', category: 'system', reason: '시스템 경로' },
  { slug: 'dashboard', category: 'system', reason: '시스템 경로' },
  { slug: 'console', category: 'system', reason: '시스템 경로' },
  { slug: 'panel', category: 'system', reason: '시스템 경로' },
  { slug: 'settings', category: 'system', reason: '시스템 경로' },
  { slug: 'config', category: 'system', reason: '시스템 경로' },
  { slug: 'configuration', category: 'system', reason: '시스템 경로' },
  { slug: 'profile', category: 'system', reason: '시스템 경로' },
  { slug: 'account', category: 'system', reason: '시스템 경로' },
  { slug: 'accounts', category: 'system', reason: '시스템 경로' },
  { slug: 'user', category: 'system', reason: '시스템 경로' },
  { slug: 'users', category: 'system', reason: '시스템 경로' },
  { slug: 'billing', category: 'system', reason: '시스템 경로' },
  { slug: 'payment', category: 'system', reason: '시스템 경로' },
  { slug: 'payments', category: 'system', reason: '시스템 경로' },
  { slug: 'checkout', category: 'system', reason: '시스템 경로' },
  { slug: 'subscribe', category: 'system', reason: '시스템 경로' },
  { slug: 'subscription', category: 'system', reason: '시스템 경로' },
  { slug: 'pricing', category: 'system', reason: '시스템 경로' },
  { slug: 'plans', category: 'system', reason: '시스템 경로' },
  { slug: 'upgrade', category: 'system', reason: '시스템 경로' },
  // API 관련
  { slug: 'api', category: 'system', reason: 'API 경로' },
  { slug: 'apis', category: 'system', reason: 'API 경로' },
  { slug: 'v1', category: 'system', reason: 'API 버전' },
  { slug: 'v2', category: 'system', reason: 'API 버전' },
  { slug: 'v3', category: 'system', reason: 'API 버전' },
  { slug: 'graphql', category: 'system', reason: 'API 타입' },
  { slug: 'rest', category: 'system', reason: 'API 타입' },
  { slug: 'webhook', category: 'system', reason: 'API 기능' },
  { slug: 'webhooks', category: 'system', reason: 'API 기능' },
  { slug: 'embed', category: 'system', reason: '임베드 경로' },
  { slug: 'widget', category: 'system', reason: '위젯 경로' },
  { slug: 'widgets', category: 'system', reason: '위젯 경로' },
  // 정적 리소스
  { slug: 'static', category: 'system', reason: '정적 리소스' },
  { slug: 'assets', category: 'system', reason: '정적 리소스' },
  { slug: 'images', category: 'system', reason: '정적 리소스' },
  { slug: 'img', category: 'system', reason: '정적 리소스' },
  { slug: 'css', category: 'system', reason: '정적 리소스' },
  { slug: 'js', category: 'system', reason: '정적 리소스' },
  { slug: 'fonts', category: 'system', reason: '정적 리소스' },
  { slug: 'media', category: 'system', reason: '정적 리소스' },
  { slug: 'files', category: 'system', reason: '정적 리소스' },
  { slug: 'uploads', category: 'system', reason: '정적 리소스' },
  { slug: 'download', category: 'system', reason: '정적 리소스' },
  { slug: 'downloads', category: 'system', reason: '정적 리소스' },
  // 시스템 파일
  { slug: 'robots', category: 'system', reason: '시스템 파일' },
  { slug: 'sitemap', category: 'system', reason: '시스템 파일' },
  { slug: 'favicon', category: 'system', reason: '시스템 파일' },
  { slug: 'manifest', category: 'system', reason: '시스템 파일' },
  { slug: 'sw', category: 'system', reason: 'Service Worker' },
  { slug: 'service-worker', category: 'system', reason: 'Service Worker' },
  { slug: 'well-known', category: 'system', reason: '시스템 경로' },
  // 법적/정책
  { slug: 'terms', category: 'system', reason: '법적 문서' },
  { slug: 'privacy', category: 'system', reason: '법적 문서' },
  { slug: 'legal', category: 'system', reason: '법적 문서' },
  { slug: 'policy', category: 'system', reason: '법적 문서' },
  { slug: 'tos', category: 'system', reason: '법적 문서 (Terms of Service)' },
  { slug: 'gdpr', category: 'system', reason: '법적 문서' },
  { slug: 'cookie', category: 'system', reason: '법적 문서' },
  { slug: 'cookies', category: 'system', reason: '법적 문서' },
  // 상태 페이지
  { slug: 'status', category: 'system', reason: '상태 페이지' },
  { slug: 'health', category: 'system', reason: '헬스 체크' },
  { slug: 'healthcheck', category: 'system', reason: '헬스 체크' },
  { slug: 'ping', category: 'system', reason: '핑 체크' },
  { slug: 'error', category: 'system', reason: '에러 페이지' },
  { slug: 'errors', category: 'system', reason: '에러 페이지' },
  { slug: '404', category: 'system', reason: '에러 페이지' },
  { slug: '500', category: 'system', reason: '에러 페이지' },
  { slug: 'maintenance', category: 'system', reason: '점검 페이지' },
  // 기타 시스템
  { slug: 'root', category: 'system', reason: '시스템 키워드' },
  { slug: 'null', category: 'system', reason: '시스템 키워드' },
  { slug: 'undefined', category: 'system', reason: '시스템 키워드' },
  { slug: 'true', category: 'system', reason: '시스템 키워드' },
  { slug: 'false', category: 'system', reason: '시스템 키워드' },
  { slug: 'localhost', category: 'system', reason: '시스템 키워드' },
  { slug: 'debug', category: 'system', reason: '시스템 키워드' },
  { slug: 'staging', category: 'system', reason: '시스템 환경' },
  { slug: 'production', category: 'system', reason: '시스템 환경' },
  { slug: 'development', category: 'system', reason: '시스템 환경' },
];

/**
 * SOFA 플랫폼 전용 키워드
 */
const sofaSlugs: ReservedSlugSeed[] = [
  // SOFA 브랜드
  { slug: 'sofa', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofaai', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofa-ai', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofabot', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofa-bot', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofachat', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  { slug: 'sofa-chat', category: 'other', reason: 'SOFA 플랫폼 브랜드' },
  // SOFA 기능 관련
  { slug: 'rag', category: 'other', reason: 'SOFA 핵심 기술' },
  { slug: 'knowledge', category: 'other', reason: 'SOFA 기능' },
  { slug: 'knowledgebase', category: 'other', reason: 'SOFA 기능' },
  { slug: 'dataset', category: 'other', reason: 'SOFA 기능' },
  { slug: 'datasets', category: 'other', reason: 'SOFA 기능' },
  { slug: 'document', category: 'other', reason: 'SOFA 기능' },
  { slug: 'documents', category: 'other', reason: 'SOFA 기능' },
  { slug: 'chunk', category: 'other', reason: 'SOFA 기능' },
  { slug: 'chunks', category: 'other', reason: 'SOFA 기능' },
  { slug: 'embedding', category: 'other', reason: 'SOFA 기능' },
  { slug: 'embeddings', category: 'other', reason: 'SOFA 기능' },
  { slug: 'vector', category: 'other', reason: 'SOFA 기능' },
  { slug: 'vectors', category: 'other', reason: 'SOFA 기능' },
  { slug: 'publish', category: 'other', reason: 'SOFA 기능' },
  { slug: 'deploy', category: 'other', reason: 'SOFA 기능' },
  { slug: 'deployment', category: 'other', reason: 'SOFA 기능' },
];

/**
 * 기타 예약 키워드
 * 스팸, 역할, 보안 관련
 */
const otherSlugs: ReservedSlugSeed[] = [
  // 역할/권한
  { slug: 'owner', category: 'other', reason: '역할 키워드' },
  { slug: 'manager', category: 'other', reason: '역할 키워드' },
  { slug: 'moderator', category: 'other', reason: '역할 키워드' },
  { slug: 'mod', category: 'other', reason: '역할 키워드' },
  { slug: 'staff', category: 'other', reason: '역할 키워드' },
  { slug: 'operator', category: 'other', reason: '역할 키워드' },
  { slug: 'superuser', category: 'other', reason: '역할 키워드' },
  { slug: 'system', category: 'other', reason: '역할 키워드' },
  { slug: 'anonymous', category: 'other', reason: '역할 키워드' },
  { slug: 'guest', category: 'other', reason: '역할 키워드' },
  // 보안 관련
  { slug: 'security', category: 'other', reason: '보안 키워드' },
  { slug: 'secure', category: 'other', reason: '보안 키워드' },
  { slug: 'password', category: 'other', reason: '보안 키워드' },
  { slug: 'reset', category: 'other', reason: '보안 키워드' },
  { slug: 'verify', category: 'other', reason: '보안 키워드' },
  { slug: 'verification', category: 'other', reason: '보안 키워드' },
  { slug: 'confirm', category: 'other', reason: '보안 키워드' },
  { slug: 'token', category: 'other', reason: '보안 키워드' },
  { slug: 'key', category: 'other', reason: '보안 키워드' },
  { slug: 'secret', category: 'other', reason: '보안 키워드' },
  // 스팸/악용 방지
  { slug: 'spam', category: 'other', reason: '스팸 방지' },
  { slug: 'scam', category: 'other', reason: '스팸 방지' },
  { slug: 'phishing', category: 'other', reason: '스팸 방지' },
  { slug: 'malware', category: 'other', reason: '스팸 방지' },
  { slug: 'virus', category: 'other', reason: '스팸 방지' },
  { slug: 'hack', category: 'other', reason: '스팸 방지' },
  { slug: 'hacker', category: 'other', reason: '스팸 방지' },
  { slug: 'exploit', category: 'other', reason: '스팸 방지' },
  { slug: 'crack', category: 'other', reason: '스팸 방지' },
  { slug: 'warez', category: 'other', reason: '스팸 방지' },
  { slug: 'torrent', category: 'other', reason: '스팸 방지' },
  { slug: 'pirate', category: 'other', reason: '스팸 방지' },
  { slug: 'piracy', category: 'other', reason: '스팸 방지' },
  // 기타
  { slug: 'www', category: 'other', reason: '예약어' },
  { slug: 'http', category: 'other', reason: '예약어' },
  { slug: 'https', category: 'other', reason: '예약어' },
  { slug: 'ftp', category: 'other', reason: '예약어' },
  { slug: 'mail', category: 'other', reason: '예약어' },
  { slug: 'email', category: 'other', reason: '예약어' },
  { slug: 'smtp', category: 'other', reason: '예약어' },
  { slug: 'pop', category: 'other', reason: '예약어' },
  { slug: 'imap', category: 'other', reason: '예약어' },
];

/**
 * 모든 시드 데이터 결합
 */
export const reservedSlugsSeed: ReservedSlugSeed[] = [
  ...profanitySlugs,
  ...brandSlugs,
  ...premiumSlugs,
  ...systemSlugs,
  ...sofaSlugs,
  ...otherSlugs,
];

/**
 * 예약 슬러그 시드 실행
 * - 기존에 있으면 건너뜀 (onConflictDoNothing)
 * - 새로운 것만 추가
 */
export async function seedReservedSlugs() {
  console.log('🔒 예약 슬러그 시드 데이터 삽입 시작...');
  console.log(`   총 ${reservedSlugsSeed.length}개의 슬러그 처리 예정`);

  const stats = {
    added: 0,
    skipped: 0,
    errors: 0,
  };

  for (const item of reservedSlugsSeed) {
    try {
      // 이미 존재하는지 확인
      const existing = await db
        .select({ id: reservedSlugs.id })
        .from(reservedSlugs)
        .where(eq(reservedSlugs.slug, item.slug))
        .limit(1);

      if (existing.length > 0) {
        stats.skipped++;
        continue;
      }

      // 새로 추가
      await db.insert(reservedSlugs).values({
        slug: item.slug,
        category: item.category,
        reason: item.reason,
        // createdBy는 null (시스템 생성)
      });

      stats.added++;
    } catch (error) {
      stats.errors++;
      console.error(`  ❌ "${item.slug}" 추가 실패:`, error);
    }
  }

  console.log(`\n📊 결과 요약:`);
  console.log(`   ✅ 추가됨: ${stats.added}개`);
  console.log(`   ⏭️  건너뜀 (이미 존재): ${stats.skipped}개`);
  if (stats.errors > 0) {
    console.log(`   ❌ 오류: ${stats.errors}개`);
  }
  console.log('✨ 예약 슬러그 시드 완료!');

  return stats;
}

/**
 * 통계 조회
 */
export function getReservedSlugStats() {
  const total = reservedSlugsSeed.length;
  const byCategory: Record<string, number> = {};

  for (const item of reservedSlugsSeed) {
    byCategory[item.category] = (byCategory[item.category] || 0) + 1;
  }

  return { total, byCategory };
}

// 직접 실행 시
const isMainModule = require.main === module;
if (isMainModule) {
  // 통계 먼저 출력
  const stats = getReservedSlugStats();
  console.log('\n📊 시드 데이터 통계:');
  console.log(`   총 ${stats.total}개`);
  for (const [category, count] of Object.entries(stats.byCategory)) {
    console.log(`   - ${category}: ${count}개`);
  }
  console.log('');

  seedReservedSlugs()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('시드 실패:', err);
      process.exit(1);
    });
}
