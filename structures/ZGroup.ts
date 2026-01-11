import Group, { IGroupInfo } from './Group.js';
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

    async getGroupInfoFromAPI(): Promise<IGroupInfo | undefined> {
        let now = new Date();
        let defaultYear = now.getFullYear() - (now.getMonth() >= 6 ? 0 : 1);
        let defaultSem = now.getMonth() > 5 ? 1 : 2;

        let lessonsPeriod = this.getLessonsPeriodFromTimetable(await this.getTimetableFromAPI(defaultYear, defaultSem));

        if (!lessonsPeriod || lessonsPeriod[0] == lessonsPeriod[1]) return undefined; // 1 день занятий, прикольно

        let out: IGroupInfo = {
            sem: defaultSem,
            year: defaultYear,
            lessonsPeriod,
            groupInfoTTL: lessonsPeriod[1],
        }

        if (lessonsPeriod[1] < now) {
            let nextSem = out.sem == 1 ? 2 : 1;
            let nextYear = out.sem == 1 ? out.year : out.year + 1;
            let nextLessonsPeriod = this.getLessonsPeriodFromTimetable(await this.getTimetableFromAPI(nextYear, nextSem));

            if (nextLessonsPeriod) {
                if (nextLessonsPeriod[0].valueOf() - 1000 * 60 * 60 * 24 * 7 < now.valueOf()) {
                    out.sem = nextSem;
                    out.year = nextYear;
                    out.lessonsPeriod = nextLessonsPeriod;
                    out.groupInfoTTL = nextLessonsPeriod[1];
                } else {
                    out.groupInfoTTL = new Date(nextLessonsPeriod[0].valueOf() - 1000 * 60 * 60 * 24 * 7);
                }
            }

        }

        if (now.valueOf() < lessonsPeriod[0].valueOf() - 1000 * 60 * 60 * 24 * 7) {
            let pastSem = out.sem == 1 ? 2 : 1;
            let pastYear = out.sem == 1 ? out.year - 1 : out.year;
            let pastLessonsPeriod = this.getLessonsPeriodFromTimetable(await this.getTimetableFromAPI(pastYear, pastSem));

            out.sem = pastSem;
            out.year = pastYear;
            out.lessonsPeriod = pastLessonsPeriod!; // Меня в принципе устраивает и undefined тут
            out.groupInfoTTL = pastLessonsPeriod ? new Date(lessonsPeriod[0].valueOf() - 1000 * 60 * 60 * 24 * 7) : new Date(now.valueOf() + 1000 * 60 * 60 * 12); // oднако, undefined всё же закеширую на пол дня
        }

        return out;
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

            // console.log(targetDate, timetable[0].timing.date);

            // targetDate.setHours(0, 0, 0, 0);

            // return timetable.filter(l => {
            //     if (!l.timing.date) return false;
            //     const lessonDate = new Date(l.timing.date);
            //     lessonDate.setHours(0, 0, 0, 0);
            //     return lessonDate.getTime() === targetDate.getTime();
            // });

            return timetable.filter((l) => l.timing.date && l.timing.date.valueOf() == targetDate)

        }

        return timetable;
    }

    isZFOGroup(): boolean {
        return true;
    }
}
