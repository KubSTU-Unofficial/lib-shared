import LessonModel, { ILessonSchema } from '../models/LessonModel.js';
import { getCurrentSemesterInfo } from '../lib/Utils.js';

const CACHE_TTL = 1000 * 60 * 60; // 1 час

export default class BaseTeacher {
    cachedFullRawSchedule?: {
        data: ILessonSchema[];
        updateDate: Date;
    };

    constructor(public name: string) { }

    mergeStreamLessons(lessons: ILessonSchema[]): ILessonSchema[] {
        const result: ILessonSchema[] = [];
        const seen = new Map<string, ILessonSchema>();

        for (const lesson of lessons) {
            if (!lesson.isStream) {
                result.push(lesson);
                continue;
            }

            // Ключ - это конкатенация свойств, определяющих уникальный урок
            const key = `${lesson.timing.weeks?.dayOfWeek}-${lesson.timing.weeks?.type}-${lesson.timing.lessonNumber}-${lesson.name}-${lesson.type}`;

            if (seen.has(key)) {
                const existing = seen.get(key)!;
                existing.group += ` | ${lesson.group}`;
            } else seen.set(key, { ...lesson });
        }

        result.push(...seen.values());
        return result;
    }

    /**
     * Берёт расписание с БД
     * Если в БД расписания нет, возвращает undefined
     */
    async getFullRawSchedule(
        year: number = getCurrentSemesterInfo().year,
        sem: number = getCurrentSemesterInfo().semester
    ): Promise<ILessonSchema[] | undefined> {
        // 1. Проверяем кэш
        if (this.cachedFullRawSchedule && (new Date().getTime() - this.cachedFullRawSchedule.updateDate.getTime()) < CACHE_TTL)
            return this.cachedFullRawSchedule.data;

        // 2. Получаем данные из БД // FIXME:
        let schedule: ILessonSchema[] = await LessonModel.find({
            teacherName: this.name,
            "timing.year": year,
            "timing.semester": sem
        }).lean().exec();

        if (!schedule || schedule.length === 0) return undefined;

        // 3. Обрабатываем и кэшируем
        schedule = this.mergeStreamLessons(schedule);

        this.cachedFullRawSchedule = {
            data: schedule,
            updateDate: new Date(),
        };

        return schedule;
    }

    static fromArray(arr: string[]): BaseTeacher {
        return new BaseTeacher(arr.reduce((a, b) => (b.length > a.length ? b : a), ''));
    }
}
