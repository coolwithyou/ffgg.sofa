'use client';

/**
 * 플로팅 글래스 헤더
 *
 * 글래스모피즘 효과의 모던한 헤더입니다.
 * - 반투명 배경 + backdrop-blur 효과
 * - 둥근 모서리(16px) + 미묘한 테두리
 * - 콘텐츠 내 배치 (static)
 * - 모바일: 햄버거 메뉴로 네비게이션 전환
 */

import { useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { HeaderProps } from './types';

export function FloatingGlassHeader({ config, theme }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, logoUrl, navLinks = [], ctaButton } = config;
  const { primaryColor } = theme;

  return (
    <header className="mb-6">
      {/* 메인 헤더 - 글래스 효과 */}
      <div
        className={cn(
          'rounded-2xl border border-border/50',
          'bg-card/80 backdrop-blur-lg shadow-sm'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3">
          {/* 로고 + 타이틀 */}
          <div className="flex items-center gap-3">
            {logoUrl ? (
              <div className="h-10 w-10 overflow-hidden rounded-full">
                <Image
                  src={logoUrl}
                  alt={title || 'Logo'}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              </div>
            ) : title ? (
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-lg font-bold text-white"
                style={{ backgroundColor: primaryColor }}
              >
                {title.charAt(0).toUpperCase()}
              </div>
            ) : null}
            {title && (
              <span className="text-lg font-semibold text-foreground">
                {title}
              </span>
            )}
          </div>

          {/* 데스크탑 네비게이션 */}
          {navLinks.length > 0 && (
            <nav className="hidden items-center gap-4 md:flex">
              {navLinks.map((link, index) => (
                <a
                  key={index}
                  href={link.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {link.label}
                </a>
              ))}
            </nav>
          )}

          {/* 우측: CTA + 모바일 메뉴 버튼 */}
          <div className="flex items-center gap-2">
            {ctaButton && (
              <Button
                size="sm"
                className="hidden md:inline-flex"
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
                className="rounded-lg p-2 hover:bg-muted md:hidden"
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

        {/* 모바일 드롭다운 메뉴 */}
        {mobileMenuOpen && (
          <div className="space-y-2 border-t border-border/50 px-4 py-3 md:hidden">
            {navLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="block py-2 text-sm text-foreground"
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </a>
            ))}
            {ctaButton && (
              <Button
                size="sm"
                className="mt-2 w-full"
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
      </div>
    </header>
  );
}
