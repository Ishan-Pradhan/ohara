import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { eventRepository } from '../repositories/events.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { enrollmentRepository } from '../repositories/enrollments.repository.js';
import { serializeEvent } from '../serializers/events.serializer.js';
import { USER_ROLES } from '../constants/index.js';
import type { EventAudience } from '../types/events.types.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

type CreateEventBody = {
  title: string;
  description?: string | null;
  startAt: string;
  audience: EventAudience;
  programId?: string;
  classId?: string;
  sectionId?: string;
  courseId?: string;
};

/** FR-35: admins may scope an event anywhere; teachers only to a course they
 * teach, or the class of a course they teach — never program/section/global. */
const assertCanCreateEvent = async (
  userId: string,
  role: string,
  body: CreateEventBody,
): Promise<void> => {
  if (role === USER_ROLES.ADMIN) return;
  if (role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, 'Only an admin or teacher may create events');
  }

  if (body.audience === 'course') {
    const isAssigned = await courseTeacherRepository.exists(userId, body.courseId as string);
    if (!isAssigned) throw new ApiError(403, 'Not authorized for this course');
    return;
  }

  if (body.audience === 'class') {
    const taught = await courseTeacherRepository.findByTeacherId(userId);
    const teachesThisClass = taught.some((ct) => ct.course?.classId === body.classId);
    if (!teachesThisClass) throw new ApiError(403, 'You do not teach any course in this class');
    return;
  }

  throw new ApiError(403, 'Teachers may only scope events to a course they teach or its class');
};

export const createEvent = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const body = req.validated?.body as CreateEventBody;

    await assertCanCreateEvent(user.id, user.role, body);

    const event = await eventRepository.create({
      createdBy: user.id,
      title: body.title,
      description: body.description ?? null,
      startAt: new Date(body.startAt),
      audience: body.audience,
      programId: body.programId ?? null,
      classId: body.classId ?? null,
      sectionId: body.sectionId ?? null,
      courseId: body.courseId ?? null,
    });
    return ok(res, serializeEvent(event), 'Event created', 201);
  },
);

/** FR-36: resolves the caller's own program/class/section/course scope and
 * returns every upcoming global event plus every upcoming event scoped to
 * anywhere in that scope. Admins see everything upcoming. */
export const listMyEvents = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }

    if (user.role === USER_ROLES.ADMIN) {
      const events = await eventRepository.findAllUpcoming();
      return ok(res, events.map(serializeEvent), 'Events retrieved');
    }

    if (user.role === USER_ROLES.TEACHER) {
      const taught = await courseTeacherRepository.findByTeacherId(user.id);
      const courseIds = taught.map((ct) => ct.courseId);
      const classIds = [...new Set(taught.map((ct) => ct.course?.classId).filter((id): id is string => Boolean(id)))];
      const classes = await Promise.all(classIds.map((id) => classRepository.findById(id)));
      const programIds = [...new Set(classes.map((c) => c?.programId).filter((id): id is string => Boolean(id)))];

      const events = await eventRepository.findUpcomingRelevantTo({
        courseIds,
        classIds,
        sectionIds: [],
        programIds,
      });
      return ok(res, events.map(serializeEvent), 'Events retrieved');
    }

    // Student — classMembershipRepository.findCurrent already includes
    // section.class.program, so no extra queries are needed for scope.
    const membership = await classMembershipRepository.findCurrent(user.id);
    const enrollments = membership
      ? await enrollmentRepository.findActiveWithDetails(user.id, membership.academicYearId)
      : [];
    const courseIds = enrollments.map((e) => e.courseId);
    const events = await eventRepository.findUpcomingRelevantTo({
      courseIds,
      classIds: membership?.section?.classId ? [membership.section.classId] : [],
      sectionIds: membership ? [membership.sectionId] : [],
      programIds: membership?.section?.class?.programId ? [membership.section.class.programId] : [],
    });
    return ok(res, events.map(serializeEvent), 'Events retrieved');
  },
);

export const deleteEvent = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.validated?.params as { id: string };

    const event = await eventRepository.findById(id);
    if (!event) {
      throw new ApiError(404, 'Event not found');
    }
    if (user.role !== USER_ROLES.ADMIN && event.createdBy !== user.id) {
      throw new ApiError(403, 'Not the creator of this event');
    }

    await eventRepository.delete(id);
    return ok(res, null, 'Event deleted');
  },
);
