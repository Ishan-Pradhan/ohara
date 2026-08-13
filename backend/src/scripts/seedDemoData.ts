/**
 * One-off demo-data seeder — NOT a sequelize-cli seeder (those are for the
 * bootstrap admin only, see sequelize/seeders/). This goes through the same
 * repositories the real app uses (never raw SQL), so every constraint the
 * app enforces at runtime — batch fixed across promotion, one membership
 * per student per academic year, section capacity, compulsory-course
 * auto-enrollment — is enforced here too, guaranteeing the seeded data is
 * exactly as valid as anything created through the UI.
 *
 * Idempotent: safe to re-run. Programs/years/classes/batches/courses are
 * found-or-created by their natural key; students/teachers are found by a
 * deterministic seed email and skipped if already present.
 *
 * Run with: npx tsx src/scripts/seedDemoData.ts
 */
import { sequelize } from '../config/db.js';
import { Program } from '../models/programs.model.js';
import { Class } from '../models/classes.model.js';
import { Course } from '../models/courses.model.js';
import { Batch } from '../models/batches.model.js';
import { AcademicYear } from '../models/academicYears.model.js';
import { Section } from '../models/sections.model.js';
import { User } from '../models/users.model.js';

import { programRepository } from '../repositories/programs.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { academicYearRepository } from '../repositories/academicYears.repository.js';
import { batchRepository } from '../repositories/batches.repository.js';
import { sectionRepository } from '../repositories/sections.repository.js';
import { courseRepository } from '../repositories/courses.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';

import { hashPassword } from '../utils/security.utils.js';
import { CLASS_MEMBERSHIP_OUTCOMES } from '../constants/index.js';

const DEMO_PASSWORD = 'DemoPass123!';
const SECTION_CAPACITY = 30;
const STUDENTS_PER_BATCH = 18; // well under the 30-per-section cap

// ── Find-or-create helpers (idempotent) ─────────────────────────────────────

const findOrCreateProgram = async (data: {
  name: string;
  affiliation?: string;
  abbreviation?: string;
}): Promise<Program> => {
  const existing = await Program.findOne({ where: { name: data.name } });
  if (existing) return existing;
  return programRepository.create({
    name: data.name,
    affiliation: data.affiliation ?? null,
    abbreviation: data.abbreviation ?? null,
  });
};

const findOrCreateClass = async (programId: string, name: string, orderIndex: number): Promise<Class> => {
  const existing = await Class.findOne({ where: { programId, orderIndex } });
  if (existing) return existing;
  return classRepository.create({ programId, name, orderIndex });
};

const findOrCreateAcademicYear = async (data: {
  name: string;
  startDate: string;
  endDate: string;
  term: 'odd' | 'even';
  isCurrent?: boolean;
}): Promise<AcademicYear> => {
  const existing = await AcademicYear.findOne({ where: { name: data.name } });
  if (existing) return existing;
  return academicYearRepository.create(data);
};

const findOrCreateBatch = async (programId: string, name: string): Promise<Batch> => {
  const existing = await Batch.findOne({ where: { programId, name } });
  if (existing) return existing;
  return batchRepository.create({ programId, name });
};

const findOrCreateSection = async (
  classId: string,
  batchId: string,
  name: string,
  startDate: string,
): Promise<Section> => {
  const existing = await Section.findOne({ where: { classId, batchId, name } });
  if (existing) return existing;
  return sectionRepository.create({ classId, batchId, name, startDate, capacity: SECTION_CAPACITY });
};

const findOrCreateCourse = async (data: {
  classId: string;
  title: string;
  code: string;
}): Promise<Course> => {
  const existing = await Course.findOne({ where: { code: data.code } });
  if (existing) return existing;
  return courseRepository.create({ classId: data.classId, title: data.title, code: data.code, courseType: 'compulsory' });
};

const findOrCreateUser = async (data: {
  name: string;
  email: string;
  role: 'teacher' | 'student';
}): Promise<{ user: User; wasCreated: boolean }> => {
  const existing = await User.findOne({ where: { email: data.email } });
  if (existing) return { user: existing, wasCreated: false };
  const user = await userRepository.create({
    name: data.name,
    email: data.email,
    password: await hashPassword(DEMO_PASSWORD),
    role: data.role,
    isVerified: true,
  });
  return { user, wasCreated: true };
};

// ── Semester -> calendar-date mapping (display/reporting only) ─────────────

/** Semester N (1-indexed) of a batch that started in `startYear` lands in
 * `startYear + floor((N-1)/2)`, alternating a January start (odd semesters)
 * and a July start (even semesters) — semester 1 starts odd, semester 2
 * starts even, semester 3 the next odd, and so on. Used only for each
 * section's `startDate` (display/reporting — see sections.model.ts), never
 * to resolve "is this current." */
const startDateForSemester = (startYear: number, semester: number): string => {
  const yearOffset = Math.floor((semester - 1) / 2);
  const year = startYear + yearOffset;
  const isOdd = semester % 2 === 1;
  return isOdd ? `${year}-01-01` : `${year}-07-01`;
};

// ── Course name pools, per program flavor (3 per semester, 8 semesters) ────

const COURSE_POOLS: Record<string, string[]> = {
  cs: [
    'C Programming', 'Digital Logic', 'Discrete Structures',
    'Object Oriented Programming', 'Data Structures & Algorithms', 'Microprocessor Architecture',
    'Database Management Systems', 'Operating Systems', 'Numerical Methods',
    'Computer Networks', 'Software Engineering', 'Theory of Computation',
    'Web Technology', 'Artificial Intelligence', 'Simulation and Modeling',
    'Computer Graphics', 'Distributed Systems', 'Cloud Computing',
    'Machine Learning', 'Cyber Security', 'Advanced Database Systems',
    'Project I', 'Mobile Application Development', 'Elective: Data Mining',
  ],
  bim: [
    'Financial Accounting', 'Business Communication', 'Principles of Management',
    'Micro Economics', 'C Programming', 'Business Mathematics',
    'Business Statistics', 'Financial Management', 'Business Environment in Nepal',
    'System Analysis and Design', 'Cost and Management Accounting', 'Organizational Behavior',
    'IT for Business', 'E-Business', 'Human Resource Management',
    'Database Management Systems', 'Marketing Management', 'Operations Management',
    'Project Management', 'Strategic Management', 'Management Information Systems',
    'Project I', 'Entrepreneurship', 'Elective: Digital Marketing',
  ],
  bba: [
    'Principles of Management', 'Business Communication', 'Financial Accounting',
    'Micro Economics', 'Business Statistics', 'Business Mathematics',
    'Organizational Behavior', 'Macro Economics', 'Cost Accounting',
    'Marketing Management', 'Financial Management', 'Business Law',
    'Human Resource Management', 'Operations Management', 'Business Research Methods',
    'International Business', 'Strategic Management', 'Investment Management',
    'Entrepreneurship', 'Corporate Finance', 'Taxation in Nepal',
    'Project I', 'Business Ethics', 'Elective: Supply Chain Management',
  ],
  bca: [
    'Programming in C', 'Digital Logic', 'Computer Architecture',
    'Object Oriented Programming', 'Data Structures', 'Discrete Mathematics',
    'Database Management Systems', 'Operating Systems', 'Statistics',
    'Web Programming', 'Computer Networking', 'Software Engineering',
    'Java Programming', 'Mobile Application Development', 'System Analysis and Design',
    'E-Commerce', 'Artificial Intelligence', 'Computer Graphics',
    'Cloud Computing', 'Information Security', 'Project Management',
    'Project I', '.NET Programming', 'Elective: Game Development',
  ],
};

interface ProgramPlan {
  key: keyof typeof COURSE_POOLS;
  name: string;
  abbreviation: string;
  affiliation: string;
  codePrefix: string;
}

const PROGRAM_PLANS: ProgramPlan[] = [
  { key: 'cs', name: 'Bachelor in computer studies', abbreviation: 'BCS', affiliation: 'Tribhuvan University', codePrefix: 'CS' },
  { key: 'bim', name: 'Bachelor of Information Management', abbreviation: 'BIM', affiliation: 'Tribhuvan University', codePrefix: 'BIM' },
  { key: 'bba', name: 'Bachelor of Business Administration', abbreviation: 'BBA', affiliation: 'Tribhuvan University', codePrefix: 'BBA' },
  { key: 'bca', name: 'Bachelor of Computer Applications', abbreviation: 'BCA', affiliation: 'Pokhara University', codePrefix: 'BCA' },
];

const SEMESTER_COUNT = 8;

// A batch's whole life story: when it started, and how many semesters it has
// actually completed/reached right now (8 = fully graduated).
const BATCH_PLANS = [
  { label: '2023', startYear: 2023, semestersReached: 8, graduated: true },
  { label: '2025', startYear: 2025, semestersReached: 5, graduated: false },
  { label: '2027', startYear: 2027, semestersReached: 1, graduated: false },
] as const;

const FIRST_NAMES = [
  'Aarav', 'Aayush', 'Abiral', 'Anish', 'Anmol', 'Anuj', 'Ashish', 'Bibek',
  'Bishal', 'Diwash', 'Kritan', 'Nabin', 'Nischal', 'Prabin', 'Prashant', 'Rohan',
  'Saroj', 'Sujan', 'Suman', 'Yubraj', 'Aashma', 'Alisha', 'Anisha', 'Anjali',
  'Barsha', 'Bibisha', 'Kripa', 'Manisha', 'Nikita', 'Pratikshya', 'Rachana',
  'Rebika', 'Sabina', 'Sandhya', 'Sarita', 'Shreya', 'Sneha', 'Sristi', 'Sunita', 'Swikriti',
];
const LAST_NAMES = [
  'Shrestha', 'Sharma', 'Adhikari', 'Poudel', 'Karki', 'Thapa', 'Gurung', 'Rai',
  'Basnet', 'Bhattarai', 'Khadka', 'Koirala', 'Maharjan', 'Neupane', 'Pandey',
  'Regmi', 'Subedi', 'Tamang', 'Acharya', 'Bista',
];

let nameCounter = 0;
const nextStudentName = (): string => {
  const first = FIRST_NAMES[nameCounter % FIRST_NAMES.length]!;
  const last = LAST_NAMES[Math.floor(nameCounter / FIRST_NAMES.length) % LAST_NAMES.length]!;
  nameCounter++;
  return `${first} ${last}`;
};

const TEACHER_FIRST_NAMES = ['Ramesh', 'Suresh', 'Gita', 'Bina', 'Hari', 'Kamala', 'Dipak', 'Sarita'];

// ── Main ─────────────────────────────────────────────────────────────────

const run = async () => {
  await sequelize.authenticate();
  console.log('Connected. Seeding demo data...\n');

  // 1. Fix the stale is_current flag this whole session has been about:
  // "2027 odd" is the term real progression already reaches — make it
  // current for the odd term (academicYearRepository.create/update already
  // atomically unsets whichever row previously held it for that term).
  const y2027odd = await AcademicYear.findOne({ where: { name: '2027 odd' } });
  if (y2027odd && !y2027odd.isCurrent) {
    await academicYearRepository.update(y2027odd.id, { isCurrent: true });
    console.log('Fixed: "2027 odd" is now the current odd-term academic year.');
  }

  // 2. Academic years for every year any batch's history touches (2023-2027).
  const yearIds = new Map<string, string>();
  for (let year = 2023; year <= 2027; year++) {
    for (const term of ['odd', 'even'] as const) {
      const name = `${year} ${term}`;
      if (name === '2027 even') continue; // not reached by any seeded batch
      const startDate = term === 'odd' ? `${year}-01-01` : `${year}-07-01`;
      const endDate = term === 'odd' ? `${year}-06-30` : `${year}-12-31`;
      const y = await findOrCreateAcademicYear({ name, startDate, endDate, term });
      yearIds.set(name, y.id);
    }
  }
  console.log(`Academic years ready: ${yearIds.size} in play (2023 odd .. 2027 odd).\n`);

  let totalStudentsCreated = 0;
  let totalTeachersCreated = 0;

  for (const plan of PROGRAM_PLANS) {
    console.log(`\n=== ${plan.name} ===`);
    const program = await findOrCreateProgram({
      name: plan.name,
      affiliation: plan.affiliation,
      abbreviation: plan.abbreviation,
    });

    // Classes: Semester 1..8
    const classes: Class[] = [];
    for (let sem = 1; sem <= SEMESTER_COUNT; sem++) {
      classes.push(await findOrCreateClass(program.id, `Semester ${sem}`, sem));
    }

    // Courses: 3 per semester from this program's pool, cycling if short.
    const pool = COURSE_POOLS[plan.key]!;
    const coursesByClassId = new Map<string, Course[]>();
    let poolIndex = 0;
    for (let sem = 1; sem <= SEMESTER_COUNT; sem++) {
      const cls = classes[sem - 1]!;
      const courses: Course[] = [];
      for (let i = 0; i < 3; i++) {
        const title = pool[poolIndex % pool.length]!;
        poolIndex++;
        const code = `${plan.codePrefix}${sem}${String(i + 1).padStart(2, '0')}`;
        courses.push(await findOrCreateCourse({ classId: cls.id, title, code }));
      }
      coursesByClassId.set(cls.id, courses);
    }
    console.log(`  Classes + courses ready (${SEMESTER_COUNT} semesters x 3 courses).`);

    // Teachers: 2 per program, assigned across every course in the curriculum.
    const teachers: User[] = [];
    for (let i = 0; i < 2; i++) {
      const first = TEACHER_FIRST_NAMES[(totalTeachersCreated + i) % TEACHER_FIRST_NAMES.length]!;
      const last = LAST_NAMES[(totalTeachersCreated + i) % LAST_NAMES.length]!;
      const email = `teacher.${plan.key}${i + 1}@ohara.edu`;
      const { user, wasCreated } = await findOrCreateUser({
        name: `${first} ${last}`,
        email,
        role: 'teacher',
      });
      teachers.push(user);
      if (wasCreated) totalTeachersCreated++;
    }
    let courseIndex = 0;
    for (const courses of coursesByClassId.values()) {
      for (const course of courses) {
        const teacher = teachers[courseIndex % teachers.length]!;
        courseIndex++;
        const alreadyAssigned = await courseTeacherRepository.findByCourseId(course.id);
        if (alreadyAssigned.length === 0) {
          await courseTeacherRepository.assign({ teacherId: teacher.id, courseId: course.id });
        }
      }
    }
    console.log(`  ${teachers.length} teachers assigned across the curriculum.`);

    // Batches + students, each walked through their real promotion history.
    for (const batchPlan of BATCH_PLANS) {
      const batch = await findOrCreateBatch(program.id, batchPlan.label);

      for (let i = 0; i < STUDENTS_PER_BATCH; i++) {
        const email = `student.${plan.key}.${batchPlan.label}.${i + 1}@ohara.edu`;
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) continue; // already seeded this student on a prior run

        const name = nextStudentName();
        const { user: student } = await findOrCreateUser({ name, email, role: 'student' });
        totalStudentsCreated++;

        let currentMembershipId: string | null = null;
        for (let sem = 1; sem <= batchPlan.semestersReached; sem++) {
          const cls = classes[sem - 1]!;
          const startDate = startDateForSemester(batchPlan.startYear, sem);

          const section = await findOrCreateSection(cls.id, batch.id, 'A', startDate);
          const compulsoryCourseIds = (coursesByClassId.get(cls.id) ?? []).map((c) => c.id);

          if (sem === 1) {
            const membership = await classMembershipRepository.create(
              { studentId: student.id, batchId: batch.id, sectionId: section.id, classId: cls.id },
              compulsoryCourseIds,
            );
            currentMembershipId = membership.id;
          } else {
            // `outcome` marks the OLD (just-superseded) membership, not the
            // new one — the new membership always defaults to 'enrolled'
            // (the model default), which is exactly right for "this is the
            // student's current, unfinished placement" on every step short
            // of the final graduate() call below.
            const promoted = await classMembershipRepository.promote(
              currentMembershipId!,
              { studentId: student.id, batchId: batch.id, sectionId: section.id, classId: cls.id },
              CLASS_MEMBERSHIP_OUTCOMES.PROMOTED,
              compulsoryCourseIds,
            );
            currentMembershipId = promoted.id;
          }
        }

        if (batchPlan.graduated && currentMembershipId) {
          await classMembershipRepository.graduate(currentMembershipId, student.id);
        }
      }
      console.log(`  Batch ${batchPlan.label}: ${STUDENTS_PER_BATCH} students, reached semester ${batchPlan.semestersReached}${batchPlan.graduated ? ' (graduated)' : ''}.`);
    }
  }

  console.log(`\nDone. ${totalStudentsCreated} new students, ${totalTeachersCreated} new teachers created this run.`);
  console.log(`Demo login password for every seeded teacher/student: ${DEMO_PASSWORD}`);
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
