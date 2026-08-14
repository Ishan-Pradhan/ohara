import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { UserPlus } from 'lucide-react';

import {
  admitStudentSchema,
  type AdmitStudentInput,
} from '../../features/admission/admission.schema.js';
import { useAdmitStudent } from '../../features/admission/useAdmission.js';
import {
  useBatches,
  usePrograms,
  useClasses,
  useSections,
} from '../../features/institution/useInstitution.js';
import { ApiError } from '../../lib/apiError.js';
import { toast } from '../../lib/toast.js';
import { AppShell } from '../../components/layout/AppShell.js';
import { PageHeader } from '../../components/layout/PageHeader.js';
import { Button } from '../../components/ui/Button.js';
import { Card } from '../../components/ui/Card.js';
import { Field } from '../../components/ui/Field.js';
import { Input } from '../../components/ui/Input.js';
import { Select } from '../../components/ui/Select.js';
import { Alert } from '../../components/ui/Alert.js';

export const AdmitStudentPage = () => {
  const navigate = useNavigate();
  const { data: programs } = usePrograms();
  const { data: classes } = useClasses();
  const admitStudent = useAdmitStudent();

  const [programId, setProgramId] = useState('');
  const [classId, setClassId] = useState('');

  const { data: batches } = useBatches(programId);

  const {
    register: field,
    handleSubmit,
    control,
    setValue,
    formState: { errors },
  } = useForm<AdmitStudentInput>({ resolver: zodResolver(admitStudentSchema) });

  const batchId = useWatch({ control, name: 'batchId' });

  // A class (e.g. "Semester 3") is reused every year across every batch, so
  // a plain classId filter returns one section per batch that has ever had
  // a "Semester 3" section — scope to this batch too, same as
  // TranscriptPage.tsx (see docs/SCHEMA.md's `sections` entry).
  const { data: sections } = useSections(
    classId && batchId ? { classId, batchId } : undefined,
  );

  const programOptions = (programs ?? []).map((p) => ({ value: p.id, label: p.name }));

  const classOptions = (classes ?? [])
    .filter((c) => c.programId === programId)
    .map((c) => ({ value: c.id, label: c.name }));

  const batchOptions = (batches ?? [])
    .filter((b) => b.programId === programId)
    .map((b) => ({ value: b.id, label: b.name }));

  const sectionOptions = (sections ?? [])
    .filter((s) => s.classId === classId && s.batchId === batchId)
    .map((s) => ({
      value: s.id,
      label:
        s.capacity !== null
          ? `${s.name} (${s.enrolledCount}/${s.capacity})`
          : `${s.name} (${s.enrolledCount} students)`,
      disabled: s.capacity !== null && s.enrolledCount >= s.capacity,
    }));

  const onSubmit = handleSubmit(async (values) => {
    try {
      const result = await admitStudent.mutateAsync(values);
      toast.success(`${result.student.name} admitted — they'll get an email to set their password`);
      navigate('/admin/students');
    } catch {
      // error already shown via admitStudent.error below; nothing else to do
    }
  });

  return (
    <AppShell>
      <PageHeader
        title="Admit student"
        description="Full admission — captures background details and places the student into a class and section in one step."
      />

      <Card className="max-w-2xl">
        <form onSubmit={onSubmit} className="flex flex-col gap-6" noValidate>
          {admitStudent.error instanceof ApiError ? (
            <Alert>{admitStudent.error.message}</Alert>
          ) : null}

          <div className="flex flex-col gap-4">
            <h2 className="text-sm font-semibold text-fg">Student</h2>
            <Field label="Full name" htmlFor="name" error={errors.name?.message}>
              <Input id="name" {...field('name')} />
            </Field>
            <Field label="Email" htmlFor="email" error={errors.email?.message}>
              <Input id="email" type="email" {...field('email')} />
            </Field>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-fg">Guardian &amp; background</h2>
            <p className="text-xs text-muted">Optional — all fields below can be filled in later.</p>
            <Field label="Parent/guardian name" htmlFor="parentName">
              <Input id="parentName" {...field('parentName')} />
            </Field>
            <Field label="Parent/guardian phone" htmlFor="parentPhone">
              <Input id="parentPhone" {...field('parentPhone')} />
            </Field>
            <Field label="Address" htmlFor="address">
              <Input id="address" {...field('address')} />
            </Field>
            <Field label="Date of birth" htmlFor="dateOfBirth">
              <Input id="dateOfBirth" type="date" {...field('dateOfBirth')} />
            </Field>
            <Field label="Previous school" htmlFor="previousSchool">
              <Input id="previousSchool" {...field('previousSchool')} />
            </Field>
            <Field label="Student's phone" htmlFor="studentPhone">
              <Input id="studentPhone" {...field('studentPhone')} />
            </Field>
          </div>

          <div className="flex flex-col gap-4 border-t border-border pt-4">
            <h2 className="text-sm font-semibold text-fg">Placement</h2>
            <Field label="Program" htmlFor="programId">
              <Select
                id="programId"
                options={programOptions}
                value={programId}
                onValueChange={(value) => {
                  setProgramId(value);
                  setClassId('');
                  setValue('sectionId', '');
                  setValue('batchId', '');
                }}
                placeholder="Select a program"
              />
            </Field>
            <Field label="Class" htmlFor="classId">
              <Select
                id="classId"
                options={classOptions}
                value={classId}
                onValueChange={(value) => {
                  setClassId(value);
                  setValue('sectionId', '');
                }}
                placeholder={programId ? 'Select a class' : 'Select a program first'}
              />
            </Field>
            <Field label="Batch" htmlFor="batchId" error={errors.batchId?.message}>
              <Controller
                control={control}
                name="batchId"
                render={({ field: selectField }) => (
                  <Select
                    id="batchId"
                    options={batchOptions}
                    value={selectField.value}
                    onValueChange={(value) => {
                      selectField.onChange(value);
                      setValue('sectionId', '');
                    }}
                    invalid={Boolean(errors.batchId)}
                    placeholder={programId ? 'Select a batch' : 'Select a program first'}
                  />
                )}
              />
            </Field>
            <Field label="Section" htmlFor="sectionId" error={errors.sectionId?.message}>
              <Controller
                control={control}
                name="sectionId"
                render={({ field: selectField }) => (
                  <Select
                    id="sectionId"
                    options={sectionOptions}
                    value={selectField.value}
                    onValueChange={selectField.onChange}
                    invalid={Boolean(errors.sectionId)}
                    placeholder={classId ? 'Select a section' : 'Select a class first'}
                  />
                )}
              />
            </Field>
          </div>

          <div className="mt-2 flex justify-end gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate('/admin/students')}>
              Cancel
            </Button>
            <Button type="submit" loading={admitStudent.isPending}>
              <UserPlus className="size-4" aria-hidden />
              Admit student
            </Button>
          </div>
        </form>
      </Card>
    </AppShell>
  );
};
