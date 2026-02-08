import Group from './Group.js';
import { ILessonSchema } from '../models/LessonModel.js';
import APIConvertor from '../lib/APIConvertor.js';

export default class BaseZGroup extends Group {

    async getTimetableFromAPI(): Promise<ILessonSchema[] | undefined>
    async getTimetableFromAPI(year: number, sem: number): Promise<ILessonSchema[] | undefined>

    async getTimetableFromAPI(year?: number, sem?: number): Promise<ILessonSchema[] | undefined> {
        if (!year && !sem) {
            let groupInfo = await this.getGroupInfo();

            year = groupInfo.year;
            sem = groupInfo.sem;
        }

        const resp = await APIConvertor.zfo(this.name, year, sem);

        if (!resp?.isok) return undefined;

        return resp.data;
    }

    getLessonsPeriodFromTimetable(timetable: ILessonSchema[] | undefined): Date[] | undefined {
        if (!timetable || !timetable.length) return undefined;

        let startDate = timetable[0].timing.date!; // TODO: В теории, оно не должно быть undefined, но можно сделать доп. проверку
        let endDate = timetable[0].timing.date!;

        for (const { timing } of timetable) {
            if (!timing.date) continue;

            const time = timing.date.getTime();

            if (time < startDate.getTime()) startDate = timing.date;
            if (time > endDate.getTime()) endDate = timing.date;
        }

        return [startDate, endDate];
    }

    async getTimetable(opts: { year?: number, sem?: number, date?: Date } = {}): Promise<ILessonSchema[] | undefined> {
        // Для ЗФО не поддерживается фильтрация по дню недели
        if ('day' in opts || 'week' in opts)
            throw new Error('Для заочной формы обучения нельзя фильтровать по дню и типу недели.');

        let timetable: ILessonSchema[] | undefined;

        if (opts.year && opts.sem) timetable = await this.getAndStoreFullTimetable(opts.year, opts.sem)
        else timetable = await this.getAndStoreFullTimetable()

        if (!timetable) return undefined;

        if (opts.date) {
            let targetDate = new Date(opts.date).setHours(0, 0, 0, 0);

            return timetable.filter((l) => l.timing.date && l.timing.date.valueOf() == targetDate)

        }

        return timetable;
    }

    isZFOGroup(): boolean {
        return true;
    }
}
