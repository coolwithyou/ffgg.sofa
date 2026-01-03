'use client';

/**
 * Console 프로필 관리 페이지
 * 사용자 정보 조회 및 수정
 * shadcn/ui Card, Button, Input, Alert 컴포넌트 적용
 */

import { useState, useEffect } from 'react';
import { User, Loader2 } from 'lucide-react';
import {
  AvatarUpload,
  EmailChangeForm,
  DeleteAccountDialog,
} from '@/components/account';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

const roleLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  owner: { label: '소유자', variant: 'default' },
  admin: { label: '관리자', variant: 'secondary' },
  member: { label: '멤버', variant: 'outline' },
};

export default function ProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await fetch('/api/user/profile');
      if (!res.ok) {
        throw new Error('프로필을 불러올 수 없습니다');
      }
      const data = await res.json();
      setProfile(data.user);
      setEditName(data.user.name || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : '오류가 발생했습니다');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!editName.trim()) {
      setSaveMessage({ type: 'error', text: '이름을 입력해주세요' });
      return;
    }

    try {
      setIsSaving(true);
      setSaveMessage(null);
      const res = await fetch('/api/user/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || '저장에 실패했습니다');
      }

      const data = await res.json();
      setProfile(data.user);
      setIsEditing(false);
      setSaveMessage({ type: 'success', text: '프로필이 수정되었습니다' });

      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage({
        type: 'error',
        text: err instanceof Error ? err.message : '저장에 실패했습니다',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditName(profile?.name || '');
    setIsEditing(false);
    setSaveMessage(null);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (!profile) {
    return null;
  }

  const roleConfig = roleLabels[profile.role] || { label: profile.role, variant: 'outline' as const };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 저장 결과 메시지 */}
      {saveMessage && (
        <Alert variant={saveMessage.type === 'success' ? 'default' : 'destructive'}>
          <AlertDescription
            className={saveMessage.type === 'success' ? 'text-green-500' : ''}
          >
            {saveMessage.text}
          </AlertDescription>
        </Alert>
      )}

      {/* 기본 정보 카드 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            <CardTitle>기본 정보</CardTitle>
          </div>
          <CardDescription>
            프로필 정보를 확인하고 수정할 수 있습니다
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 프로필 이미지 */}
          <AvatarUpload
            currentAvatar={profile.avatarUrl}
            userName={profile.name}
            onUpdate={(newAvatarUrl) => {
              setProfile((prev) =>
                prev ? { ...prev, avatarUrl: newAvatarUrl } : null
              );
            }}
          />

          <Separator />

          {/* 이름 필드 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              이름
            </label>
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="이름을 입력하세요"
                  autoFocus
                />
                <div className="flex gap-2">
                  <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        저장 중...
                      </>
                    ) : (
                      '저장'
                    )}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleCancel}
                    disabled={isSaving}
                    size="sm"
                  >
                    취소
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <p className="text-foreground">
                  {profile.name || '(미설정)'}
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsEditing(true)}
                >
                  수정
                </Button>
              </div>
            )}
          </div>

          <Separator />

          {/* 이메일 변경 */}
          <EmailChangeForm
            currentEmail={profile.email}
            onSuccess={() => {
              fetchProfile();
            }}
          />

          <Separator />

          {/* 역할 (읽기 전용) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              역할
            </label>
            <div>
              <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
            </div>
          </div>

          {/* 가입일 (읽기 전용) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-muted-foreground">
              가입일
            </label>
            <p className="text-foreground">{formatDate(profile.createdAt)}</p>
          </div>
        </CardContent>
      </Card>

      {/* 계정 삭제 카드 */}
      <Card variant="ghost" className="border-destructive/30">
        <CardHeader>
          <CardTitle className="text-destructive">계정 삭제</CardTitle>
          <CardDescription>
            계정을 삭제하면 30일의 유예 기간 후 모든 데이터가 영구적으로 삭제됩니다.
            유예 기간 내에 다시 로그인하면 삭제를 취소할 수 있습니다.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button
            variant="outline"
            className="border-destructive text-destructive hover:bg-destructive/10"
            onClick={() => setIsDeleteDialogOpen(true)}
          >
            계정 삭제 요청
          </Button>
        </CardContent>
      </Card>

      {/* 계정 삭제 다이얼로그 - Console용 리다이렉트 경로 */}
      <DeleteAccountDialog
        isOpen={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        redirectPath="/login?deleted=pending"
      />
    </div>
  );
}
