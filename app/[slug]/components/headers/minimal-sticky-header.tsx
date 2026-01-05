'use client';

/**
 * 미니멀 스티키 헤더
 *
 * 깔끔하고 단순한 미니멀 스타일 헤더입니다.
 * - 높이 56px, 하단 테두리
 * - 콘텐츠 내 배치 (static)
 * - 로고 + 네비 + CTA 균형 배치
 * - 모바일: 햄버거 메뉴로 전환
 */

import { useState } from 'react';
import Image from 'next/image';
import { Menu, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { HeaderProps } from './types';

export function MinimalStickyHeader({ config, theme }: HeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { title, logoUrl, navLinks = [], ctaButton } = config;
  const { primaryColor } = theme;

  return (
    <header className="mb-6 border-b border-border">
      <div className="flex h-14 items-center justify-between px-4">
        {/* 로고 + 타이틀 */}
        <div className="flex items-center gap-3">
          {logoUrl ? (
            <div className="h-8 w-8 overflow-hidden rounded-lg">
              <Image
                src={logoUrl}
                alt={title || 'Logo'}
                width={32}
                height={32}
                className="h-full w-full object-cover"
              />
            </div>
          ) : title ? (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ backgroundColor: primaryColor }}
            >
              {title.charAt(0).toUpperCase()}
            </div>
          ) : null}
          {title && (
            <span className="font-semibold text-foreground">{title}</span>
          )}
        </div>

        {/* 데스크탑 네비게이션 */}
        {navLinks.length > 0 && (
          <nav className="hidden items-center gap-6 md:flex">
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

        {/* 우측 영역 */}
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

      {/* 모바일 메뉴 */}
      {mobileMenuOpen && (
        <div className="space-y-2 border-t border-border px-4 py-3 md:hidden">
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
    </header>
  );
}
