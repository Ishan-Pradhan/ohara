/**
 * Wipes assignments and quizzes (and everything that cascades from them —
 * submissions, grades, questions, quiz attempts, quiz answer grades) so
 * seedActivityData.ts can regenerate a richer set from scratch.
 *
 * Deliberately narrow: does NOT touch Programs/Classes/Sections/Batches/
 * Courses/Users/ClassMemberships/Enrollments/Attendance/ExamMarks — those
 * are shared with real accounts and hold real content (uploaded documents,
 * tutor conversations) that must survive this reset.
 *
 * Run with: npx tsx src/scripts/resetActivityData.ts
 */
import { sequelize } from '../config/db.js';
import { Assignment } from '../models/assignments.model.js';
import { Quiz } from '../models/quizzes.model.js';

const run = async () => {
  await sequelize.authenticate();
  console.log('Connected. Wiping assignments and quizzes...\n');

  const assignmentsDeleted = await Assignment.destroy({ where: {}, truncate: false });
  console.log(`Deleted ${assignmentsDeleted} assignments (submissions/grades cascaded).`);

  const quizzesDeleted = await Quiz.destroy({ where: {}, truncate: false });
  console.log(`Deleted ${quizzesDeleted} quizzes (questions/attempts/answer grades cascaded).`);

  console.log('\nDone. Run `npx tsx src/scripts/seedActivityData.ts` to regenerate.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Reset failed:', err);
  process.exit(1);
});
