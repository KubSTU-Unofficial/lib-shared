import Group from './Group.js';
import { ILessonSchema } from '../models/LessonModel.js';
import APIConvertor from '../lib/APIConvertor.js';


export default class BaseOGroup extends Group {

    async getTimetableFromAPI(): Promise<ILessonSchema[] | undefined>
    async getTimetableFromAPI(year: number, sem: number): Promise<ILessonSchema[] | undefined>

    async getTimetableFromAPI(year?: number, sem?: number): Promise<ILessonSchema[] | undefined> {
        if (!year && !sem) {
            let groupInfo = await this.getGroupInfo();

            year = groupInfo.year;
            sem = groupInfo.sem;
        } else if (!year !== !sem) throw Error("OGroup.getTimetableFromAPI: Нельзя указать год и не указать семестр")

        const resp = await APIConvertor.ofo(this.name, year, sem);

        if (!resp?.isok) return undefined;

        return resp.data;
    }

    getLessonsPeriodFromTimetable(timetable: ILessonSchema[] | undefined) {
        if (!timetable?.length) return undefined;

        let startDate = timetable[0].timing.weeks!.startDate;
        let endDate = timetable[0].timing.weeks!.endDate;

        for (const { timing } of timetable) {
            if (!timing.weeks) continue;

            const timeStart = timing.weeks.startDate.getTime();
            const timeEnd = timing.weeks.endDate.getTime();

            if (timeStart < startDate.getTime()) startDate = timing.weeks.startDate;
            if (timeEnd > endDate.getTime()) endDate = timing.weeks.endDate;
        }

        return [startDate, endDate];
    }

    async getTimetable(opts: { year?: number, sem?: number, date?: Date, day?: number, week?: boolean } = {}): Promise<ILessonSchema[] | undefined> {
        const hasDayFilter = opts.day !== undefined && opts.week !== undefined;
        const hasDateFilter = opts.date !== undefined;

        let timetable: ILessonSchema[] | undefined;

        if (opts.year && opts.sem) timetable = await this.getAndStoreFullTimetable(opts.year, opts.sem)
        else timetable = await this.getAndStoreFullTimetable()

        if (!timetable) return undefined;

        // Если фильтры не нужны, возвращаем всё
        if (!hasDayFilter && !hasDateFilter) return timetable;

        // Применяем фильтры к полному расписанию
        if (hasDateFilter) {
            const weekType = opts.date!.getWeek() % 2 === 0;
            const dayOfWeek = opts.date!.getDay();
            return timetable.filter(l => l.timing.weeks?.type === weekType && l.timing.weeks?.dayOfWeek === dayOfWeek);
        } else if (hasDayFilter) return timetable
            .filter(l => l.timing.weeks?.type === opts.week && l.timing.weeks?.dayOfWeek === opts.day);

        return timetable
    }

    isZFOGroup(): boolean {
        return false;
    }
}
