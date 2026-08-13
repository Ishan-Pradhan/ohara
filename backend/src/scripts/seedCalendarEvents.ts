/**
 * Third-pass demo seeder: calendar events — weekly Sat/Sun holidays, real
 * Nepali festival holidays, and exam-period events for the currently active
 * semesters. Goes through eventRepository (never raw inserts).
 *
 * IMPORTANT CAVEAT: Nepali festival dates (Dashain, Tihar, Holi, Maghe
 * Sankranti, etc.) follow the lunisolar Bikram Sambat calendar and shift
 * every Gregorian year — they are NOT computed here, they're a hand-picked
 * best estimate for 2026/2027 for demo purposes. Verify against an official
 * Nepali patro before relying on these for anything real. Fixed-Gregorian
 * holidays (Republic Day, Constitution Day, Christmas, etc.) are exact.
 *
 * Run with: npx tsx src/scripts/seedCalendarEvents.ts
 */
import { Op } from 'sequelize';
import { sequelize } from '../config/db.js';
import { User } from '../models/users.model.js';
import { Event } from '../models/events.model.js';
import { Class } from '../models/classes.model.js';
import { ClassMembership } from '../models/classMemberships.model.js';
import { Section } from '../models/sections.model.js';

import { eventRepository } from '../repositories/events.repository.js';

const HOLIDAY_WINDOW_START = new Date('2026-08-01');
const HOLIDAY_WINDOW_END = new Date('2027-12-31');

const dateOnly = (d: Date): string => d.toISOString().slice(0, 10);

const findOrCreateGlobalHoliday = async (adminId: string, title: string, date: Date, description?: string): Promise<boolean> => {
  const existing = await Event.findOne({
    where: { title, startAt: { [Op.gte]: date, [Op.lt]: new Date(date.getTime() + 24 * 60 * 60 * 1000) } },
  });
  if (existing) return false;
  await eventRepository.create({
    createdBy: adminId,
    title,
    description: description ?? null,
    type: 'holiday',
    startAt: date,
    endAt: null,
    allDay: true,
    audience: 'global',
  });
  return true;
};

// ── Weekly Saturday + Sunday holidays ──────────────────────────────────

const seedWeekendHolidays = async (adminId: string) => {
  console.log('\n--- Weekly Sat/Sun holidays ---');
  let created = 0;
  const cur = new Date(HOLIDAY_WINDOW_START);
  while (cur <= HOLIDAY_WINDOW_END) {
    const day = cur.getDay();
    if (day === 0 || day === 6) {
      const title = day === 6 ? 'Saturday Holiday' : 'Sunday Holiday';
      if (await findOrCreateGlobalHoliday(adminId, title, new Date(cur), 'Weekly holiday.')) created++;
    }
    cur.setDate(cur.getDate() + 1);
  }
  console.log(`Weekend holiday events created: ${created}`);
};

// ── Real Nepali festivals (approximate dates for 2026/2027 — see caveat above) ─

interface FestivalPlan {
  title: string;
  date: string; // YYYY-MM-DD
  note: string;
}

const FESTIVALS: FestivalPlan[] = [
  // Remaining 2026 (from Aug 12)
  { title: 'Janai Purnima', date: '2026-08-28', note: 'Approximate lunar date.' },
  { title: 'Teej', date: '2026-09-04', note: 'Approximate lunar date.' },
  { title: 'Constitution Day', date: '2026-09-19', note: 'Fixed date.' },
  { title: 'Indra Jatra', date: '2026-09-15', note: 'Approximate lunar date.' },
  { title: 'Ghatasthapana (Dashain begins)', date: '2026-10-11', note: 'Approximate lunar date.' },
  { title: 'Fulpati', date: '2026-10-19', note: 'Approximate lunar date.' },
  { title: 'Maha Ashtami', date: '2026-10-20', note: 'Approximate lunar date.' },
  { title: 'Vijaya Dashami (Dashain)', date: '2026-10-21', note: 'Approximate lunar date — main Dashain day.' },
  { title: 'Laxmi Puja (Tihar)', date: '2026-11-08', note: 'Approximate lunar date.' },
  { title: 'Bhai Tika (Tihar)', date: '2026-11-11', note: 'Approximate lunar date.' },
  { title: 'Chhath Parva', date: '2026-11-15', note: 'Approximate lunar date.' },
  { title: 'Christmas', date: '2026-12-25', note: 'Fixed date.' },
  // 2027
  { title: 'Maghe Sankranti', date: '2027-01-14', note: 'Solar date, fairly fixed.' },
  { title: 'Democracy Day', date: '2027-02-19', note: 'Fixed date.' },
  { title: 'Maha Shivaratri', date: '2027-02-24', note: 'Approximate lunar date.' },
  { title: 'Holi (Fagu Purnima)', date: '2027-03-03', note: 'Approximate lunar date.' },
  { title: 'Nepali New Year 2084', date: '2027-04-14', note: 'Solar Bikram Sambat date, fairly fixed.' },
  { title: 'International Labor Day', date: '2027-05-01', note: 'Fixed date.' },
  { title: 'Buddha Jayanti', date: '2027-05-10', note: 'Approximate lunar date.' },
  { title: 'Republic Day', date: '2027-05-29', note: 'Fixed date.' },
  { title: 'Janai Purnima', date: '2027-08-18', note: 'Approximate lunar date.' },
  { title: 'Teej', date: '2027-08-24', note: 'Approximate lunar date.' },
  { title: 'Constitution Day', date: '2027-09-19', note: 'Fixed date.' },
  { title: 'Vijaya Dashami (Dashain)', date: '2027-10-10', note: 'Approximate lunar date — main Dashain day.' },
  { title: 'Laxmi Puja (Tihar)', date: '2027-10-29', note: 'Approximate lunar date.' },
  { title: 'Christmas', date: '2027-12-25', note: 'Fixed date.' },
];

const seedFestivals = async (adminId: string) => {
  console.log('\n--- Nepali festival holidays ---');
  let created = 0;
  for (const f of FESTIVALS) {
    if (await findOrCreateGlobalHoliday(adminId, f.title, new Date(f.date), f.note)) created++;
  }
  console.log(`Festival holiday events created: ${created} (of ${FESTIVALS.length} planned)`);
};

// ── Exam-period events for the currently active semesters ──────────────

const seedExamPeriodEvents = async (adminId: string) => {
  console.log('\n--- Exam period events ---');
  const activeClassIds = await ClassMembership.findAll({
    where: { outcome: 'enrolled' },
    include: [
      { model: User, as: 'student', where: { email: { [Op.like]: 'student.%@ohara.edu' } }, attributes: ['id'] },
      { model: Section, as: 'section', attributes: ['classId'] },
    ],
  }).then((rows) => [...new Set(rows.map((r) => (r.section as unknown as { classId: string }).classId))]);

  let created = 0;
  for (const classId of activeClassIds) {
    const cls = await Class.findByPk(classId);
    if (!cls) continue;

    const midterm = { title: `${cls.name} Mid-Term Examinations`, date: new Date('2026-09-21') };
    const final = { title: `${cls.name} Final Examinations`, date: new Date('2026-11-16') };

    for (const exam of [midterm, final]) {
      const existing = await Event.findOne({ where: { title: exam.title, classId } });
      if (existing) continue;
      await eventRepository.create({
        createdBy: adminId,
        title: exam.title,
        description: `${exam.title} for this semester.`,
        type: 'exam',
        startAt: exam.date,
        endAt: new Date(exam.date.getTime() + 6 * 24 * 60 * 60 * 1000), // ~1 week exam window
        allDay: true,
        audience: 'class',
        classId,
      });
      created++;
    }
  }
  console.log(`Exam period events created: ${created} (across ${activeClassIds.length} active classes)`);
};

// ── Main ─────────────────────────────────────────────────────────────────

const run = async () => {
  await sequelize.authenticate();
  console.log('Connected. Seeding calendar events...');
  console.log(`(Window: ${dateOnly(HOLIDAY_WINDOW_START)} .. ${dateOnly(HOLIDAY_WINDOW_END)})`);

  const admin = await User.findOne({ where: { role: 'admin' } });
  if (!admin) throw new Error('No admin user found — run the base seeder first.');

  await seedWeekendHolidays(admin.id);
  await seedFestivals(admin.id);
  await seedExamPeriodEvents(admin.id);

  console.log('\nDone.');
  process.exit(0);
};

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
