import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { User } from 'lucide-react';

import { useMyProfile, useUpdateMyProfile } from '../../features/studentProfile/useStudentProfile.js';
import { updateStudentProfileSchema, type UpdateStudentProfileInput } from '../../features/studentProfile/studentProfile.schema.js';
import { useCurrentUser } from '../../features/auth/useAuth.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Card } from '../../components/ui/Card.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Field } from '../../components/ui/Field.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { EmptyState } from '../../components/ui/EmptyState.js';

export const StudentProfilePage = () => {
  const { data: user } = useCurrentUser();
  const { data: profile, isLoading } = useMyProfile();
  const updateProfile = useUpdateMyProfile();
  const [isEditing, setIsEditing] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<UpdateStudentProfileInput>({
    resolver: zodResolver(updateStudentProfileSchema),
    values: {
      parentName: profile?.parentName ?? null,
      parentPhone: profile?.parentPhone ?? null,
      address: profile?.address ?? null,
      dateOfBirth: profile?.dateOfBirth ?? null,
      previousSchool: profile?.previousSchool ?? null,
      studentPhone: profile?.studentPhone ?? null,
    },
  });

  const onSubmit = async (data: UpdateStudentProfileInput) => {
    try {
      await updateProfile.mutateAsync(data);
      toast.success('Profile updated');
      setIsEditing(false);
    } catch {
      toast.error('Failed to update profile');
    }
  };

  return (
    <AppShell>
      <PageHeader
        title="My Profile"
        description="View and update your personal information."
      />

      {isLoading ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          <Card padding="md">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex size-16 items-center justify-center rounded-full bg-primary-soft">
                <User className="size-8 text-primary" aria-hidden />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-fg">{user?.name ?? 'Student'}</h2>
                <p className="text-sm text-muted">{user?.email}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-xs text-subtle">Role</p>
                <p className="font-medium text-fg capitalize">{user?.role}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Status</p>
                <p className="font-medium text-fg capitalize">{user?.status}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Account type</p>
                <p className="font-medium text-fg capitalize">{user?.authProvider}</p>
              </div>
              <div>
                <p className="text-xs text-subtle">Member since</p>
                <p className="font-medium text-fg">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}
                </p>
              </div>
            </div>
          </Card>

          <Card padding="md">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold text-fg">Personal Information</h3>
              {!isEditing ? (
                <Button variant="secondary" size="sm" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setIsEditing(false);
                      reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    loading={updateProfile.isPending}
                    onClick={() => void handleSubmit(onSubmit)()}
                  >
                    Save
                  </Button>
                </div>
              )}
            </div>

            {!profile && !isEditing ? (
              <EmptyState
                icon={User}
                title="No profile data yet"
                description="Your personal information will appear here once added by an administrator."
              />
            ) : (
              <form onSubmit={(e) => void handleSubmit(onSubmit)(e)} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Student phone" error={errors.studentPhone?.message}>
                    <Input
                      {...register('studentPhone')}
                      placeholder="Phone number"
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Date of birth" error={errors.dateOfBirth?.message}>
                    <Input
                      {...register('dateOfBirth')}
                      type="date"
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Parent name" error={errors.parentName?.message}>
                    <Input
                      {...register('parentName')}
                      placeholder="Parent or guardian name"
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Parent phone" error={errors.parentPhone?.message}>
                    <Input
                      {...register('parentPhone')}
                      placeholder="Parent phone number"
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Previous school" error={errors.previousSchool?.message}>
                    <Input
                      {...register('previousSchool')}
                      placeholder="Previous school name"
                      disabled={!isEditing}
                    />
                  </Field>
                  <Field label="Address" error={errors.address?.message} className="sm:col-span-2">
                    <Input
                      {...register('address')}
                      placeholder="Home address"
                      disabled={!isEditing}
                    />
                  </Field>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </AppShell>
  );
};
