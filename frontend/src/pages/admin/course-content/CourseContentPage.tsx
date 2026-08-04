import { useParams } from 'react-router-dom';

import { useCourses } from '../../../features/institution/useInstitution.js';
import { usePublishCourse } from '../../../features/courseContent/useCourseContent.js';
import { toast } from '../../../lib/toast.js';
import { AppShell } from '../../../components/layout/AppShell.js';
import { PageHeader } from '../../../components/layout/PageHeader.js';
import { Badge } from '../../../components/ui/Badge.js';
import { Switch } from '../../../components/ui/Switch.js';
import { Skeleton } from '../../../components/ui/Skeleton.js';
import { DocumentsSection } from './DocumentsSection.js';
import { ModulesSection } from './ModulesSection.js';

export const CourseContentPage = () => {
  const { courseId = '' } = useParams();
  const { data: courses, isLoading } = useCourses();
  const course = courses?.find((c) => c.id === courseId);
  const publishCourse = usePublishCourse(courseId);

  const onTogglePublish = async (checked: boolean) => {
    await publishCourse.mutateAsync(checked);
    toast.success(checked ? 'Course published' : 'Course unpublished');
  };

  return (
    <AppShell>
      {isLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (
        <PageHeader
          title={course ? course.title : 'Course content'}
          description={course ? `${course.code} — documents, modules, and lessons.` : undefined}
          actions={
            course ? (
              <div className="flex items-center gap-3">
                <Badge variant={course.isPublished ? 'success' : 'neutral'}>
                  {course.isPublished ? 'Published' : 'Draft'}
                </Badge>
                <Switch
                  checked={course.isPublished}
                  onCheckedChange={onTogglePublish}
                  disabled={publishCourse.isPending}
                  id="publish-toggle"
                />
              </div>
            ) : undefined
          }
        />
      )}

      <div className="flex flex-col gap-10">
        <DocumentsSection courseId={courseId} />
        <ModulesSection courseId={courseId} />
      </div>
    </AppShell>
  );
};
