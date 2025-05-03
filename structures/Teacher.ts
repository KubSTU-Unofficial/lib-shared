import LessonModel, { ILessonSchema } from '../models/LessonModel.js';

export default class BaseTeacher {
    cachedFullRawSchedule?: {
        data: ILessonSchema[];
        updateDate: Date;
    };

    constructor(public name: string) {}

    mergeStreamLessons(lessons: ILessonSchema[]): ILessonSchema[] {
        const result: ILessonSchema[] = [];
        const seen = new Map<string, ILessonSchema>();

        for(const lesson of lessons) {
            if(!lesson.isStream) {
                result.push(lesson);
                continue;
            }

            // Ключ — сериализованные некоторые свойства
            const key = JSON.stringify({
                day: lesson.day,
                number: lesson.number,
                name: lesson.name,
                type: lesson.type,
                classroom: lesson.classroom,
                percentOfGroup: lesson.percentOfGroup,
                isDistant: lesson.isDistant,
            });

            if(seen.has(key)) {
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
    async getFullRawSchedule(): Promise<ILessonSchema[] | undefined> {
        let date = new Date();

        if(this.cachedFullRawSchedule && date.valueOf() - this.cachedFullRawSchedule.updateDate.valueOf() < 1000 * 60 * 60 * 4)
            return this.cachedFullRawSchedule.data;

        let schedule: ILessonSchema[] = await LessonModel.find({ teacherName: this.name }).lean().exec();

        if(!schedule) return undefined;

        schedule = this.mergeStreamLessons(schedule);

        this.cachedFullRawSchedule = {
            data: schedule,
            updateDate: new Date(),
        };

        return schedule;
    }

    static fromArray(arr: string[]) {
        // Возможно поиск самой большой строки - это не самый правильный вариант, но самый простой и, вроде бы, логичный.
        // У кого инициалы могут быть больше полного ФИО?
        return new BaseTeacher(arr.reduce((a, b) => (b.length > a.length ? b : a), ''));
    }
}
