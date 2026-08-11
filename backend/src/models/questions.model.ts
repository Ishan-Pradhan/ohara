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

import { QUESTION_TYPES } from '../constants/index.js';
import type { QuestionType, McqAnswer, QuestionDifficulty, CognitiveLevel } from '../types/quizzes.types.js';
import { Quiz } from './quizzes.model.js';

@Table({ tableName: 'Questions', timestamps: true })
export class Question extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  declare id: string;

  @ForeignKey(() => Quiz)
  @AllowNull(false)
  @Column(DataType.UUID)
  declare quizId: string;

  @BelongsTo(() => Quiz)
  declare quiz?: Quiz;

  @AllowNull(false)
  @Column(DataType.ENUM(QUESTION_TYPES.MCQ, QUESTION_TYPES.SHORT_ANSWER))
  declare type: QuestionType;

  @AllowNull(false)
  @Column(DataType.TEXT)
  declare prompt: string;

  // mcq only — the answer choices shown to the student.
  @Column(DataType.JSONB)
  declare options: string[] | null;

  // mcq only — { correctIndex }. Never serialized to a student before they attempt.
  @Column(DataType.JSONB)
  declare answer: McqAnswer | null;

  @AllowNull(false)
  @Default(1)
  @Column(DataType.INTEGER)
  declare points: number;

  @AllowNull(false)
  @Column(DataType.INTEGER)
  declare orderIndex: number;

  @Column(DataType.ENUM('easy', 'medium', 'hard'))
  declare difficulty: QuestionDifficulty | null;

  @Column(DataType.ENUM('remember', 'understand', 'apply', 'analyze', 'evaluate', 'create'))
  declare cognitiveLevel: CognitiveLevel | null;
}
