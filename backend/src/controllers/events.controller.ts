import type { Response } from 'express';

import type { AuthRequest } from '../types/auth.types.js';
import { eventRepository } from '../repositories/events.repository.js';
import { courseTeacherRepository } from '../repositories/courseTeachers.repository.js';
import { classRepository } from '../repositories/classes.repository.js';
import { classMembershipRepository } from '../repositories/classMemberships.repository.js';
import { userRepository } from '../repositories/users.repository.js';
import { studentProfileRepository } from '../repositories/studentProfiles.repository.js';
import { serializeEvent, serializeBirthday } from '../serializers/events.serializer.js';
import { USER_ROLES } from '../constants/index.js';
import type { EventAudience, EventType } from '../types/events.types.js';
import type { InstitutionType } from '../types/institution.types.js';
import { asyncHandler } from '../utils/AsyncHandler.js';
import { ok } from '../utils/ApiResponse.js';
import { ApiError } from '../utils/ApiError.js';

type CreateEventBody = {
  title: string;
  description?: string | null;
  type: EventType;
  startAt: string;
  endAt?: string | null;
  allDay: boolean;
  audience: EventAudience;
  institutionType?: InstitutionType;
  programId?: string;
  classId?: string;
};

const DEFAULT_RANGE_PAST_MS = 30 * 24 * 60 * 60 * 1000; // 1 month
const DEFAULT_RANGE_FUTURE_MS = 180 * 24 * 60 * 60 * 1000; // 6 months

/** FR-35: admins may scope an event anywhere; teachers only to a class they
 * teach (derived from the courses they're assigned to) — never
 * institution_type/program/global, and events are no longer course-scoped
 * at all. */
const assertCanCreateEvent = async (
  userId: string,
  role: string,
  body: CreateEventBody,
): Promise<void> => {
  if (role === USER_ROLES.ADMIN) return;
  if (role !== USER_ROLES.TEACHER) {
    throw new ApiError(403, 'Only an admin or teacher may create events');
  }
  if (body.audience !== 'class') {
    throw new ApiError(403, 'Teachers may only scope events to a class they teach');
  }

  const taught = await courseTeacherRepository.findByTeacherId(userId);
  const teachesThisClass = taught.some((ct) => ct.course?.classId === body.classId);
  if (!teachesThisClass) {
    throw new ApiError(403, 'You do not teach any course in this class');
  }
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
      type: body.type,
      startAt: new Date(body.startAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
      allDay: body.allDay,
      audience: body.audience,
      institutionType: body.institutionType ?? null,
      programId: body.programId ?? null,
      classId: body.classId ?? null,
    });
    return ok(res, serializeEvent(event), 'Event created', 201);
  },
);

/** Every occurrence of month/day `dob` that falls inside [from, to] —
 * usually one, but a range spanning New Year's can contain two (or the
 * range can contain zero if the birthday doesn't fall within it). */
const projectBirthdaysInRange = (dob: string, from: Date, to: Date): Date[] => {
  const [, month, day] = dob.split('-').map(Number);
  const occurrences: Date[] = [];
  for (let year = from.getFullYear(); year <= to.getFullYear(); year += 1) {
    const occurrence = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1));
    if (occurrence >= from && occurrence <= to) {
      occurrences.push(occurrence);
    }
  }
  return occurrences;
};

/** FR-36: resolves the caller's own program/class/institution-type scope
 * and returns every event in range that's global or in that scope. Admins
 * see everything in range, plus every user's birthday projected into it. */
export const listMyEvents = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { from: fromRaw, to: toRaw } = (req.validated?.query ?? {}) as { from?: string; to?: string };
    const from = fromRaw ? new Date(fromRaw) : new Date(Date.now() - DEFAULT_RANGE_PAST_MS);
    const to = toRaw ? new Date(toRaw) : new Date(Date.now() + DEFAULT_RANGE_FUTURE_MS);

    if (user.role === USER_ROLES.ADMIN) {
      const events = await eventRepository.findAllInRange(from, to);
      const serialized = events.map(serializeEvent);

      const [teacherAdminBirthdays, studentBirthdays] = await Promise.all([
        userRepository.findAllWithDateOfBirth(),
        studentProfileRepository.findAllWithDateOfBirth(),
      ]);
      const birthdayPeople = [
        ...teacherAdminBirthdays.map((u) => ({ id: u.id, name: u.name, dob: u.dateOfBirth as string })),
        ...studentBirthdays
          .filter((p) => p.user)
          .map((p) => ({ id: p.user!.id, name: p.user!.name, dob: p.dateOfBirth as string })),
      ];
      const birthdays = birthdayPeople.flatMap((person) =>
        projectBirthdaysInRange(person.dob, from, to).map((occurrence) =>
          serializeBirthday({ id: person.id, name: person.name }, occurrence),
        ),
      );

      return ok(res, [...serialized, ...birthdays], 'Events retrieved');
    }

    if (user.role === USER_ROLES.TEACHER) {
      const taught = await courseTeacherRepository.findByTeacherId(user.id);
      const classIds = [...new Set(taught.map((ct) => ct.course?.classId).filter((id): id is string => Boolean(id)))];
      const classes = await Promise.all(classIds.map((id) => classRepository.findByIdWithProgram(id)));
      const programIds = [...new Set(classes.map((c) => c?.programId).filter((id): id is string => Boolean(id)))];
      const institutionTypes = [
        ...new Set(classes.map((c) => c?.program?.institutionType).filter((t): t is InstitutionType => Boolean(t))),
      ];

      const events = await eventRepository.findRelevantInRange({ institutionTypes, programIds, classIds }, from, to);
      return ok(res, events.map(serializeEvent), 'Events retrieved');
    }

    // Student — classMembershipRepository.findCurrent already includes
    // section.class.program, so no extra queries are needed for scope.
    const membership = await classMembershipRepository.findCurrent(user.id);
    const events = membership?.section?.class
      ? await eventRepository.findRelevantInRange(
          {
            institutionTypes: membership.section.class.program?.institutionType
              ? [membership.section.class.program.institutionType]
              : [],
            programIds: membership.section.class.programId ? [membership.section.class.programId] : [],
            classIds: [membership.section.classId],
          },
          from,
          to,
        )
      : await eventRepository.findRelevantInRange({ institutionTypes: [], programIds: [], classIds: [] }, from, to);
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

export const updateEvent = asyncHandler(
  async (req: AuthRequest, res: Response) => {
    const user = req.user;
    if (!user) {
      throw new ApiError(401, 'Unauthorized');
    }
    const { id } = req.validated?.params as { id: string };
    const body = req.validated?.body as CreateEventBody;

    const event = await eventRepository.findById(id);
    if (!event) {
      throw new ApiError(404, 'Event not found');
    }
    if (user.role !== USER_ROLES.ADMIN && event.createdBy !== user.id) {
      throw new ApiError(403, 'Not the creator of this event');
    }

    await assertCanCreateEvent(user.id, user.role, body);

    const updated = await eventRepository.update(id, {
      title: body.title,
      description: body.description ?? null,
      type: body.type,
      startAt: new Date(body.startAt),
      endAt: body.endAt ? new Date(body.endAt) : null,
      allDay: body.allDay,
      audience: body.audience,
      institutionType: body.institutionType ?? null,
      programId: body.programId ?? null,
      classId: body.classId ?? null,
    });
    return ok(res, serializeEvent(updated), 'Event updated');
  },
);
