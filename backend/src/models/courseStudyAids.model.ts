import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
} from 'sequelize-typescript';

import { STUDY_AID_TYPES } from '../types/courseStudyAids.types.js';
import type { StudyAidType, StudyAidContent } from '../types/courseStudyAids.types.js';
import { Course } from './courses.model.js';
import { Lesson } from './lessons.model.js';
import { User } from './users.model.js';

/** AI-generated study content — a lesson or course summary, or a flashcard
 * set — generated once and shared by every student of that course/lesson,
 * not per-student like `TeacherDashboardInsight`/`StudyPlan`: the content
 * here is derived purely from course material, not from any one student's
 * performance, so regenerating it per student would just burn LLM quota for
 * an identical result. `content`'s shape depends on `type` (see
 * `StudyAidContent` in types/courseStudyAids.types.ts) — validated with Zod
 * before ever being stored, never trusted raw from the model. */
@Table({ tableName: 'CourseStudyAids', timestamps: true })
export class CourseStudyAid extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Course)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare courseId: string;

  @BelongsTo(() => Course)
  declare course?: Course;

  @ForeignKey(() => Lesson)
  @Default(null)
  @Column(DataType.UUID)
  declare lessonId: string | null;

  @BelongsTo(() => Lesson)
  declare lesson?: Lesson;

  @AllowNull(false)
  @Column(DataType.ENUM(STUDY_AID_TYPES.SUMMARY, STUDY_AID_TYPES.FLASHCARDS))
  declare type: StudyAidType;

  @AllowNull(false)
  @Column(DataType.JSONB)
  declare content: StudyAidContent;

  @ForeignKey(() => User)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare generatedBy: string;

  @BelongsTo(() => User)
  declare generator?: User;
}
