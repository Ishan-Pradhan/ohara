import type { AccessibleCourse } from '../features/courses/useAccessibleCourses.js';
import { Select } from './ui/Select.js';

interface CourseSwitcherProps {
  courses: AccessibleCourse[];
  selectedCourseId: string;
  onSelect: (courseId: string) => void;
}

export const CourseSwitcher = ({ courses, selectedCourseId, onSelect }: CourseSwitcherProps) => (
  <div className="max-w-xs">
    <Select
      value={selectedCourseId}
      onValueChange={onSelect}
      placeholder="Select a course"
      options={courses.map((c) => ({ value: c.id, label: `${c.title} (${c.code})` }))}
    />
  </div>
);
