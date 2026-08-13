import 'reflect-metadata';
import {
  Table,
  Column,
  Model,
  DataType,
  Default,
  AllowNull,
  Unique,
  PrimaryKey,
  ForeignKey,
  BelongsTo,
  BelongsToMany,
  HasMany,
} from 'sequelize-typescript';

import { Class } from './classes.model.js';
import { User } from './users.model.js';
import { CourseTeacher } from './courseTeachers.model.js';
import { Module } from './modules.model.js';
import { Document } from './documents.model.js';

@Table({ tableName: 'Courses', timestamps: true })
export class Course extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Class)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare classId: string;

  @BelongsTo(() => Class)
  declare class?: Class;

  @AllowNull(false)
  @Column(DataType.STRING)
  declare title: string;

  @AllowNull(false)
  @Unique
  @Column(DataType.STRING)
  declare code: string;

  @Default(null)
  @Column(DataType.STRING)
  declare description: string | null;

  /** A course isn't teachable through the portal until a teacher publishes
   * its generated/edited structure — see FR-18. */
  @AllowNull(false)
  @Default(false)
  @Column(DataType.BOOLEAN)
  declare isPublished: boolean;

  @AllowNull(false)
  @Default('compulsory')
  @Column(DataType.ENUM('compulsory', 'elective'))
  declare courseType: 'compulsory' | 'elective';

  /** Seat cap for self-enrolled electives. Null means uncapped — mirrors
   * Section.capacity. Meaningless for compulsory courses (auto-enroll never
   * checks it), but the column isn't restricted to electives at the DB level. */
  @Default(null)
  @Column(DataType.INTEGER)
  declare capacity: number | null;

  /** The single document (of possibly several uploaded) the tutor and quiz
   * generation are allowed to ground answers/questions in — see
   * documentChunkRepository.findSimilar/existsForDocument, both scoped by
   * this id rather than by course, and tutorAgent.ts which resolves it once
   * per turn. Null means "no RAG source selected" — treated the same as "no
   * material" by both consumers. Uploading a document does not select it;
   * a teacher chooses explicitly via setKnowledgeBaseDocument. Two separate
   * FKs to Document on this model (this one and syllabusDocumentId below)
   * need explicit foreignKey/as — sequelize-typescript can't infer which
   * @ForeignKey belongs to which @BelongsTo once there's more than one
   * association to the same target model. */
  @ForeignKey(() => Document)
  @Default(null)
  @Column(DataType.UUID)
  declare knowledgeBaseDocumentId: string | null;

  @BelongsTo(() => Document, { foreignKey: 'knowledgeBaseDocumentId', as: 'knowledgeBaseDocument' })
  declare knowledgeBaseDocument?: Document;

  /** The single document that defines this course's official module/lesson
   * structure — see courseContent.controller.ts's generateSkeleton, which
   * uses this document's own text (extracted, not RAG-retrieved) to produce
   * a skeleton matching an official syllabus's units exactly, instead of
   * the model inventing a grouping from the course-material document. Null
   * means "no syllabus set" — generation falls back to inventing structure
   * from the target document, same as before this field existed.
   * Independent of knowledgeBaseDocumentId: a course can have a syllabus
   * document, a knowledge-base document, both, or neither, and they are
   * often two different uploads (the official syllabus PDF vs. a
   * textbook). */
  @ForeignKey(() => Document)
  @Default(null)
  @Column(DataType.UUID)
  declare syllabusDocumentId: string | null;

  @BelongsTo(() => Document, { foreignKey: 'syllabusDocumentId', as: 'syllabusDocument' })
  declare syllabusDocument?: Document;

  @BelongsToMany(() => User, () => CourseTeacher)
  declare teachers?: User[];

  @HasMany(() => Module)
  declare modules?: Module[];
}
