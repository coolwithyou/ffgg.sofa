'use client';

/**
 * 필 네비게이션 헤더
 *
 * 네비게이션을 둥근 pill 컨테이너로 그룹화한 트렌디 헤더입니다.
 * - 둥근 pill 컨테이너
 * - 호버/활성 시 배경색 변화
 * - 콘텐츠 내 배치 (static)
 * - 모바일: 햄버거 메뉴로 전환
 */

import { useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeaderProps } from './types';

export function PillNavHeader({ config, theme }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, logoUrl, navLinks = [], ctaButton } = config;
  const { primaryColor } = theme;

  return (
    <header className="mb-6">
      {/* 메인 pill 컨테이너 */}
      <div className="flex items-center justify-between gap-4 rounded-full border border-border bg-card px-4 py-2">
        {/* 로고 + 타이틀 */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="h-9 w-9 overflow-hidden rounded-full">
              <Image
                src={logoUrl}
                alt={title || 'Logo'}
                width={36}
                height={36}
                className="h-full w-full object-cover"
              />
            </div>
          ) : title ? (
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {title.charAt(0).toUpperCase()}
            </div>
          ) : null}
          {title && (
            <span className="font-semibold text-foreground">{title}</span>
          )}
        </div>

        {/* 데스크탑: Pill 스타일 네비게이션 */}
        {navLinks.length > 0 && (
          <nav className="hidden items-center gap-1 rounded-full bg-muted p-1 md:flex">
            {navLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className={cn(
                  'rounded-full px-4 py-2 text-sm transition-colors',
                  'text-muted-foreground',
                  'hover:bg-background hover:text-foreground hover:shadow-sm'
                )}
              >
                {link.label}
              </a>
            ))}
          </nav>
        )}

        {/* 우측 영역 */}
        <div className="flex items-center gap-2">
          {ctaButton && (
            <Button
              size="sm"
              className="hidden rounded-full md:inline-flex"
              style={
                ctaButton.variant === 'primary'
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
              variant={
                ctaButton.variant === 'ghost'
                  ? 'ghost'
                  : ctaButton.variant === 'secondary'
                    ? 'outline'
                    : 'default'
              }
              asChild
            >
              <a href={ctaButton.href}>{ctaButton.label}</a>
            </Button>
          )}

          {/* 모바일 햄버거 버튼 */}
          {(navLinks.length > 0 || ctaButton) && (
            <button
              type="button"
              className="rounded-full p-2 hover:bg-muted md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* 모바일 메뉴 */}
      {mobileMenuOpen && (
        <div className="mt-2 space-y-2 rounded-2xl border border-border bg-card p-4 md:hidden">
          {navLinks.map((link, index) => (
            <a
              key={index}
              href={link.href}
              className="block rounded-full px-4 py-2 text-sm text-foreground hover:bg-muted"
              onClick={() => setMobileMenuOpen(false)}
            >
              {link.label}
            </a>
          ))}
          {ctaButton && (
            <Button
              size="sm"
              className="mt-2 w-full rounded-full"
              style={
                ctaButton.variant === 'primary'
                  ? { backgroundColor: primaryColor }
                  : undefined
              }
              variant={
                ctaButton.variant === 'ghost'
                  ? 'ghost'
                  : ctaButton.variant === 'secondary'
                    ? 'outline'
                    : 'default'
              }
              asChild
            >
              <a href={ctaButton.href}>{ctaButton.label}</a>
            </Button>
          )}
        </div>
      )}
    </header>
  );
}
