'use client';

/**
 * 프로필 탭
 * 사용자 정보 조회 및 수정
 */

import { useState, useEffect } from 'react';
import EmailChangeForm from '../components/email-change-form';
import AvatarUpload from '../components/avatar-upload';

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
  avatarUrl: string | null;
  createdAt: string;
}

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

      // 3초 후 메시지 숨기기
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-destructive">
        {error}
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const roleLabels: Record<string, string> = {
    owner: '소유자',
    admin: '관리자',
    member: '멤버',
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* 알림 메시지 */}
      {saveMessage && (
        <div
          className={`rounded-lg border p-4 ${
            saveMessage.type === 'success'
              ? 'border-green-500/50 bg-green-500/10 text-green-500'
              : 'border-destructive/50 bg-destructive/10 text-destructive'
          }`}
        >
          {saveMessage.text}
        </div>
      )}

      {/* 프로필 정보 카드 */}
      <div className="rounded-lg border border-border bg-card p-6">
        <h2 className="mb-6 text-lg font-semibold text-foreground">
          기본 정보
        </h2>

        <div className="space-y-6">
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

          <hr className="border-border" />

          {/* 이름 */}
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <label className="text-sm font-medium text-muted-foreground">
                이름
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2 text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="이름을 입력하세요"
                  autoFocus
                />
              ) : (
                <p className="mt-1 text-foreground">
                  {profile.name || '(미설정)'}
                </p>
              )}
            </div>
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="ml-4 text-sm text-primary hover:text-primary/80"
              >
                수정
              </button>
            )}
          </div>

          {/* 편집 모드 버튼 */}
          {isEditing && (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
              >
                취소
              </button>
            </div>
          )}

          {/* 이메일 변경 */}
          <EmailChangeForm
            currentEmail={profile.email}
            onSuccess={() => {
              // 성공 시 프로필 새로고침
              fetchProfile();
            }}
          />

          {/* 역할 (읽기 전용) */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              역할
            </label>
            <p className="mt-1 text-foreground">
              {roleLabels[profile.role] || profile.role}
            </p>
          </div>

          {/* 가입일 (읽기 전용) */}
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              가입일
            </label>
            <p className="mt-1 text-foreground">{formatDate(profile.createdAt)}</p>
          </div>
        </div>
      </div>

      {/* 계정 삭제 섹션 */}
      <div className="rounded-lg border border-destructive/30 bg-card p-6">
        <h2 className="mb-2 text-lg font-semibold text-destructive">
          계정 삭제
        </h2>
        <p className="mb-4 text-sm text-muted-foreground">
          계정을 삭제하면 30일의 유예 기간 후 모든 데이터가 영구적으로 삭제됩니다.
          유예 기간 내에 다시 로그인하면 삭제를 취소할 수 있습니다.
        </p>
        <button
          onClick={() => {
            // TODO: 삭제 다이얼로그 표시
            alert('계정 삭제 기능은 곧 구현됩니다');
          }}
          className="rounded-md border border-destructive px-4 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          계정 삭제 요청
        </button>
      </div>
    </div>
  );
}
