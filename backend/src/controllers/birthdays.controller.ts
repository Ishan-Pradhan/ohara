import type { Response } from 'express';
import { Op } from 'sequelize';

import type { AuthRequest } from '../types/auth.types.js';
import { userRepository } from '../repositories/users.repository.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { institutionProfileRepository } from '../repositories/institutionProfile.repository.js';
import { BirthdayWish } from '../models/birthdayWish.model.js';
import { sendBirthdayWishEmail } from '../services/email.service.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

/** Project every occurrence of month/day `dob` that falls on today's date
 * across recent and upcoming years, then check if it matches today. */
const isBirthdayToday = (dob: string): boolean => {
  const today = new Date();
  const [, month, day] = dob.split('-').map(Number);
  return today.getMonth() + 1 === month && today.getDate() === day;
};

export const getTodayBirthdays = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10); // YYYY-MM-DD

    // Fetch all users with DOB (teachers/admins)
    const teacherAdminUsers = await userRepository.findAllWithDateOfBirth();

    // Fetch all students with DOB
    const studentProfiles = await studentProfileRepository.findAllWithDateOfBirth();

    // Filter to only those whose birthday is today
    const teacherAdminBirthdays = teacherAdminUsers
      .filter((u) => u.dateOfBirth && isBirthdayToday(u.dateOfBirth))
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        dateOfBirth: u.dateOfBirth!,
        role: u.role as 'admin' | 'teacher' | 'student',
        avatarUrl: u.avatarUrl ?? null,
      }));

    const studentBirthdays = studentProfiles
      .filter((p) => p.user && p.dateOfBirth && isBirthdayToday(p.dateOfBirth))
      .map((p) => ({
        id: p.user!.id,
        name: p.user!.name,
        email: p.user!.email,
        dateOfBirth: p.dateOfBirth!,
        role: 'student' as const,
        avatarUrl: p.user!.avatarUrl ?? null,
      }));

    const allBirthdays = [...teacherAdminBirthdays, ...studentBirthdays];

    // Check which students have already been wished today
    if (allBirthdays.length > 0) {
      const studentIds = allBirthdays
        .filter((b) => b.role === 'student')
        .map((b) => b.id);

      if (studentIds.length > 0) {
        const startOfDay = new Date(todayStr + 'T00:00:00Z');
        const endOfDay = new Date(todayStr + 'T23:59:59Z');

        const wishes = await BirthdayWish.findAll({
          where: {
            recipientId: { [Op.in]: studentIds },
            sentAt: { [Op.gte]: startOfDay, [Op.lte]: endOfDay },
          },
          attributes: ['recipientId'],
        });
        const wishedIds = new Set(wishes.map((w) => w.recipientId));

        for (const b of allBirthdays) {
          if (b.role === 'student') {
            (b as typeof b & { wishedToday: boolean }).wishedToday = wishedIds.has(b.id);
          }
        }
      }
    }

    // Add wishedToday: false for non-students (they can't be wished through this flow)
    for (const b of allBirthdays) {
      if (b.role !== 'student') {
        (b as typeof b & { wishedToday: boolean }).wishedToday = false;
      }
    }

    return ok(res, allBirthdays, 'Today\'s birthdays');
  },
);

export const sendBirthdayWish = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    const { studentIds, message } = req.validated?.body as {
      studentIds: string[];
      message: string;
    };

    const profile = await institutionProfileRepository.get();
    const institutionName = profile?.name ?? 'Ohara';

    let sent = 0;
    let failed = 0;

    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const startOfDay = new Date(todayStr + 'T00:00:00Z');
    const endOfDay = new Date(todayStr + 'T23:59:59Z');

    for (const studentId of studentIds) {
      // Check if already wished today
      const existing = await BirthdayWish.findOne({
        where: {
          recipientId: studentId,
          sentAt: { [Op.gte]: startOfDay, [Op.lte]: endOfDay },
        },
      });
      if (existing) {
        failed++;
        continue;
      }

      // Find the student
      const student = await userRepository.findById(studentId);
      if (!student || student.role !== 'student' || !student.email) {
        failed++;
        continue;
      }

      try {
        await sendBirthdayWishEmail(
          student.email,
          student.name,
          user.name,
          institutionName,
          message,
        );
        await BirthdayWish.create({
          recipientId: studentId,
          senderId: user.id,
          message,
          sentAt: today,
        });
        sent++;
      } catch {
        failed++;
      }
    }

    return ok(res, { sent, failed }, `Birthday wishes sent: ${sent} success, ${failed} failed`);
  },
);
