'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronsUpDown, LogOut, Settings, User } from 'lucide-react';

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from '@/components/ui/sidebar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

import { navItems, type NavItem } from './nav-config';
import { useCurrentChatbot } from '../../hooks/use-console-state';
import { Bot, Check, Plus, Sofa } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

/**
 * SidebarHeader의 ChatbotSwitcher
 *
 * 드롭다운으로 챗봇을 전환할 수 있는 선택기
 */
function SidebarChatbotSwitcher() {
  const { chatbots, currentChatbot, currentChatbotIndex, selectChatbot } =
    useCurrentChatbot();

  const handleSelect = (index: number) => {
    selectChatbot(index);
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              {/* 챗봇 아이콘 */}
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="size-4 text-primary" />
              </div>

              {/* 챗봇 이름 (축소 시 숨김) */}
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">
                  {currentChatbot?.name ?? '챗봇 선택'}
                </span>
                {currentChatbot?.slug && (
                  <span className="truncate text-xs text-muted-foreground">
                    /{currentChatbot.slug}
                  </span>
                )}
              </div>

              {/* 공개 상태 + 드롭다운 화살표 */}
              <div className="flex items-center gap-1">
                {currentChatbot?.publicPageEnabled && (
                  <span className="size-2 rounded-full bg-green-500" />
                )}
                <ChevronsUpDown className="ml-auto size-4" />
              </div>
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side="bottom"
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              챗봇 목록
            </DropdownMenuLabel>

            {chatbots.map((bot, index) => {
              const isSelected = currentChatbotIndex === index;
              return (
                <DropdownMenuItem
                  key={bot.id}
                  onClick={() => handleSelect(index)}
                  className="gap-2 p-2"
                >
                  <div className="flex size-6 items-center justify-center rounded-sm border">
                    <Bot className="size-4 shrink-0" />
                  </div>
                  <span className="flex-1 truncate">{bot.name}</span>
                  {bot.publicPageEnabled && (
                    <span className="size-2 rounded-full bg-green-500" />
                  )}
                  {isSelected && <Check className="size-4" />}
                </DropdownMenuItem>
              );
            })}

            <DropdownMenuSeparator />

            <DropdownMenuItem className="gap-2 p-2">
              <div className="flex size-6 items-center justify-center rounded-md border bg-background">
                <Plus className="size-4" />
              </div>
              <div className="font-medium text-muted-foreground">새 챗봇 추가</div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * 메인 네비게이션 메뉴
 */
function NavMain() {
  const pathname = usePathname();

  // 현재 경로가 해당 아이템의 경로와 일치하는지 확인
  const isActive = (item: NavItem) => {
    if (item.href && pathname === item.href) return true;
    if (item.subItems?.some((sub) => pathname === sub.href)) return true;
    // 부분 매칭
    if (item.href && pathname.startsWith(item.href)) return true;
    if (item.subItems?.some((sub) => pathname.startsWith(sub.href))) return true;
    return false;
  };

  // 서브아이템이 활성화되어 있는지 확인
  const isSubItemActive = (href: string) => {
    return pathname === href || pathname.startsWith(href);
  };

  return (
    <SidebarGroup>
      <SidebarGroupLabel>메뉴</SidebarGroupLabel>
      <SidebarMenu>
        {navItems.map((item) => {
          const Icon = item.icon;
          const hasSubItems = item.subItems && item.subItems.length > 0;

          // 서브메뉴가 있는 경우 (항상 펼쳐진 상태)
          if (hasSubItems) {
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton tooltip={item.label} isActive={isActive(item)}>
                  <Icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {item.subItems?.map((subItem) => (
                    <SidebarMenuSubItem key={subItem.id}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isSubItemActive(subItem.href)}
                      >
                        <Link href={subItem.href}>
                          <span>{subItem.label}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            );
          }

          // 서브메뉴가 없는 경우 직접 링크
          return (
            <SidebarMenuItem key={item.id}>
              <SidebarMenuButton
                asChild
                tooltip={item.label}
                isActive={isActive(item)}
              >
                <Link href={item.href ?? '#'}>
                  <Icon />
                  <span>{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}

/**
 * 사용자 메뉴 (SidebarFooter)
 */
function NavUser() {
  // TODO: 실제 사용자 정보로 교체
  const user = {
    name: '사용자',
    email: 'user@example.com',
    avatar: '',
  };

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                <AvatarImage src={user.avatar} alt={user.name} />
                <AvatarFallback className="rounded-lg">
                  {user.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{user.name}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  <AvatarImage src={user.avatar} alt={user.name} />
                  <AvatarFallback className="rounded-lg">
                    {user.name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{user.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="mr-2 size-4" />
                프로필
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 size-4" />
                설정
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <LogOut className="mr-2 size-4" />
              로그아웃
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}

/**
 * AppSidebar
 *
 * 항상 펼쳐진 상태의 메인 사이드바
 * - SidebarHeader: 로고 + 챗봇 선택기
 * - SidebarContent: 메인 네비게이션 메뉴 (각 메뉴 아이템 폴드 가능)
 * - SidebarFooter: 사용자 메뉴
 */
export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar {...props}>
      <SidebarHeader className="gap-0 p-0">
        {/* 로고 */}
        <div className="flex h-14 items-center gap-2 px-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-lg font-bold tracking-tight text-primary"
          >
            <Sofa className="h-5 w-5" />
            <span>SOFA</span>
          </Link>
        </div>

        <Separator />

        {/* 챗봇 선택기 */}
        <div className="p-2">
          <SidebarChatbotSwitcher />
        </div>

        <Separator />
      </SidebarHeader>

      <SidebarContent>
        <NavMain />
      </SidebarContent>

      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
