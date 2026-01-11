import LessonModel, { ILessonSchema } from '../models/LessonModel.js';
// import { getCurrentSemesterInfo } from '../lib/Utils.js';
import { format } from 'date-fns';
import { LRUCache } from "lru-cache";

// const CACHE_TTL = 1000 * 60 * 60; // 1 час

export default class BaseTeacher {
    cachedFullRawSchedule?: {
        data: ILessonSchema[];
        updateDate: Date;
    };

    cache: { timetable: LRUCache<string, ILessonSchema[]> } = {
        timetable: new LRUCache<string, ILessonSchema[]>({
            max: 30,
            ttl: 1000 * 60 * 60 * 24,
        }),
    }

    constructor(public name: string) { }

    static async searchTeacher(name: string) {
        let lessons = await LessonModel.find({ teacherName: name }).lean().exec();

        if (lessons.length) return [name];
        else return LessonModel.find({ $text: { $search: name } }).distinct("teacherName").lean().exec();
    }

    async getDayTimetable(date: Date = new Date()) {
        return this.getDayTimetableFromCache(date) ?? this.getDayTimetableFromDb(date);
    }

    async getAndStoreDayTimetable(date: Date = new Date()) {
        let tt = this.getDayTimetableFromCache(date);

        if (tt) return tt;

        tt = await this.getDayTimetableFromDb(date);

        if (tt) {
            this.sendDayTimetableToCache(tt, date);

            return tt;
        }

        return undefined;
    }

    mergeStreamLessons(lessons: ILessonSchema[]): ILessonSchema[] {
        const result: ILessonSchema[] = [];
        const seen = new Map<string, ILessonSchema>();

        for (const lesson of lessons) {
            if (!lesson.isStream) {
                result.push(lesson);
                continue;
            }

            // Ключ - это конкатенация свойств, определяющих уникальный урок
            const key = `${lesson.classroom}--${lesson.name}--${lesson.timing.lessonNumber}`;

            if (seen.has(key)) {
                const existing = seen.get(key)!;
                existing.group += ` | ${lesson.group}`;
            } else seen.set(key, { ...lesson });
        }

        result.push(...seen.values());
        return result;
    }

    async getDayTimetableFromDb(inpDate: Date = new Date()): Promise<ILessonSchema[] | undefined> {
        let date = new Date(inpDate);
        date.setHours(0, 0, 0, 0);

        let tt = await LessonModel.find({
            teacherName: this.name,
            $or: [
                {
                    "timing.date": date,
                }, {
                    "timing.weeks.startDate": { $lte: date },
                    "timing.weeks.endDate": { $gte: date },
                    "timing.weeks.dayOfWeek": date.getDay(),
                    "timing.weeks.type": date.getWeek() % 2 == 0,
                }
            ]
        }).lean().exec();

        if (!tt) return undefined;

        return this.mergeStreamLessons(tt).sort((a, b) => a.timing.lessonNumber - b.timing.lessonNumber);
    }

    getDayTimetableFromCache(date: Date = new Date()) {
        return this.cache.timetable.get(format(date, "dd-MM-yyyy"));
    }

    sendDayTimetableToCache(timetable: ILessonSchema[], date: Date = new Date()) {
        this.cache.timetable.set(format(date, "dd-MM-yyyy"), timetable);
    }

    // TODO: Написать метод получения расписания на определённую неделю

    /**
     * Берёт расписание с БД
     * Если в БД расписания нет, возвращает undefined
     */
    // async getFullRawSchedule(
    //     year: number = getCurrentSemesterInfo().year,
    //     sem: number = getCurrentSemesterInfo().semester
    // ): Promise<ILessonSchema[] | undefined> {
    //     // 1. Проверяем кэш
    //     if (this.cachedFullRawSchedule && (new Date().getTime() - this.cachedFullRawSchedule.updateDate.getTime()) < CACHE_TTL)
    //         return this.cachedFullRawSchedule.data;
    //
    //     // 2. Получаем данные из БД
    //     let schedule: ILessonSchema[] = await LessonModel.find({
    //         teacherName: this.name,
    //         "timing.year": year,
    //         "timing.semester": sem
    //     }).lean().exec();
    //
    //     if (!schedule || schedule.length === 0) return undefined;
    //
    //     // 3. Обрабатываем и кэшируем
    //     schedule = this.mergeStreamLessons(schedule);
    //
    //     this.cachedFullRawSchedule = {
    //         data: schedule,
    //         updateDate: new Date(),
    //     };
    //
    //     return schedule;
    // }
    //
    // static fromArray(arr: string[]): BaseTeacher {
    //     return new BaseTeacher(arr.reduce((a, b) => (b.length > a.length ? b : a), ''));
    // }
}
