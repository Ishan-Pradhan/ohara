import { useEffect } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Building2 } from 'lucide-react';

import {
  updateInstitutionProfileSchema,
  type UpdateInstitutionProfileInput,
} from '../../features/institution/institution.schema.js';
import {
  useInstitutionProfile,
  useUpdateInstitutionProfile,
} from '../../features/institution/useInstitution.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Checkbox } from '../../components/ui/Checkbox.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Alert } from '../../components/ui/Alert.js';

export const SettingsPage = () => {
  const { data: profile, isLoading } = useInstitutionProfile();
  const { mutateAsync, isPending, error } = useUpdateInstitutionProfile();

  const {
    register: field,
    handleSubmit,
    control,
    reset: resetForm,
    watch,
    formState: { errors },
  } = useForm<UpdateInstitutionProfileInput>({
    resolver: zodResolver(updateInstitutionProfileSchema),
  });

  const selfRegistrationEnabled = watch('selfRegistrationEnabled');

  useEffect(() => {
    if (!profile) return;
    resetForm({
      name: profile.name,
      tagline: profile.tagline ?? '',
      address: profile.address ?? '',
      contactEmail: profile.contactEmail ?? '',
      allowedEmailDomain: profile.allowedEmailDomain ?? '',
      selfRegistrationEnabled: profile.selfRegistrationEnabled,
    });
  }, [profile, resetForm]);

  const onSubmit = handleSubmit(async (values) => {
    await mutateAsync(values);
    toast.success('Institution profile saved');
  });

  return (
    <AppShell>
      <PageHeader
        title="Institution"
        description="Your institution's identity — shown across the app to everyone who signs in."
      />

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (
        <Card className="max-w-xl">
          <div className="mb-6 flex items-start gap-4">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary-soft">
              <Building2 className="size-5.5 text-primary" aria-hidden />
            </div>
            <div>
              <h2 className="text-base font-semibold text-fg">Profile</h2>
              <p className="mt-1 text-sm text-muted">
                This name and tagline appear in the sidebar and on every dashboard. Program-level
                affiliations (e.g. a bachelor program affiliated to a university) are set on the
                program itself.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
            {error instanceof ApiError ? <Alert>{error.message}</Alert> : null}

            <Field label="Institution name" htmlFor="name" error={errors.name?.message}>
              <Input id="name" placeholder="e.g. NCCS College" {...field('name')} />
            </Field>

            <Field
              label="Tagline"
              htmlFor="tagline"
              error={errors.tagline?.message}
              hint="Optional — a short line shown under the name"
            >
              <Input id="tagline" placeholder="e.g. Since 1998" {...field('tagline')} />
            </Field>

            <Field
              label="Address"
              htmlFor="address"
              error={errors.address?.message}
              hint="Optional"
            >
              <Input id="address" {...field('address')} />
            </Field>

            <Field
              label="Contact email"
              htmlFor="contactEmail"
              error={errors.contactEmail?.message}
              hint="Optional"
            >
              <Input id="contactEmail" type="email" {...field('contactEmail')} />
            </Field>

            <div className="mt-2 border-t border-border pt-4">
              <h3 className="text-sm font-semibold text-fg">Student registration</h3>
              <p className="mt-1 text-sm text-muted">
                Teachers and admins are never self-registered — invite them from Staff instead.
              </p>
            </div>

            <Controller
              control={control}
              name="selfRegistrationEnabled"
              render={({ field: checkboxField }) => (
                <label className="flex cursor-pointer items-center gap-2.5 text-sm text-fg">
                  <Checkbox
                    checked={checkboxField.value ?? true}
                    onCheckedChange={checkboxField.onChange}
                  />
                  Allow students to self-register at /register
                </label>
              )}
            />

            {selfRegistrationEnabled === false ? (
              <Alert variant="info">
                Self-registration is off — students can only get in via Students → Invite
                students.
              </Alert>
            ) : (
              <Field
                label="Allowed student email domain"
                htmlFor="allowedEmailDomain"
                error={errors.allowedEmailDomain?.message}
                hint={
                  errors.allowedEmailDomain
                    ? undefined
                    : "Optional — if your students don't have institutional email, leave this blank and use Invite students instead"
                }
              >
                <Input
                  id="allowedEmailDomain"
                  placeholder="e.g. nccs.edu.np"
                  {...field('allowedEmailDomain')}
                />
              </Field>
            )}

            <div className="mt-2 flex justify-end">
              <Button type="submit" loading={isPending}>
                Save changes
              </Button>
            </div>
          </form>
        </Card>
      )}
    </AppShell>
  );
};
