import BaseGroup, { IGroupInfo } from './Group.js';
import { ILessonSchema } from '../models/LessonModel.js';
import APIConvertor, { parseCalendar } from '../lib/APIConvertor.js';


export default class BaseOGroup extends BaseGroup {

    async getTimetableFromAPI(): Promise<ILessonSchema[] | undefined>
    async getTimetableFromAPI(year: number, sem: number): Promise<ILessonSchema[] | undefined>

    async getTimetableFromAPI(year?: number, sem?: number): Promise<ILessonSchema[] | undefined> {
        let lessonsPeriod: Date[] | undefined;

        if (!year && !sem) {
            let groupInfo = await this.getGroupInfo();
            lessonsPeriod = groupInfo.lessonsPeriod;

            year = groupInfo.year;
            sem = groupInfo.sem;
        } else if (year && sem) {
            lessonsPeriod = await parseCalendar(this.name, sem, year);
        } else throw Error("OGroup.getTimetableFromAPI: Нельзя указать год и не указать семестр")

        const resp = await APIConvertor.ofo(this.name, year, sem);

        if (!resp?.isok) return undefined;

        // Обогащаем данные датами начала/конца недель
        if (lessonsPeriod) {
            resp.data.forEach((elm) => {
                if (elm.timing.weeks) {
                    const fromOffset = 1000 * 60 * 60 * 24 * 7 * (elm.timing.weeks.from - 1);
                    const toOffset = 1000 * 60 * 60 * 24 * 7 * (elm.timing.weeks.to - 1);

                    elm.timing.weeks.startDate = new Date(lessonsPeriod[0].valueOf() + fromOffset);
                    elm.timing.weeks.endDate = new Date(lessonsPeriod[0].valueOf() + toOffset);
                }
            });
        }

        return resp.data;
    }

    /*
     * Получает текущий график занятий, год и семестр
     * */
    async getGroupInfoFromAPI() {
        let now = new Date();
        let defaultYear = now.getFullYear() - (now.getMonth() >= 6 ? 0 : 1);
        let defaultSem = now.getMonth() > 5 ? 1 : 2;

        let lessonsPeriod = await parseCalendar(this.name, defaultSem, defaultYear); // Получения графика (с какого по какую дату)

        if (!lessonsPeriod) return undefined;

        let out: IGroupInfo = {
            sem: defaultSem,
            year: defaultYear,
            lessonsPeriod,
            groupInfoTTL: lessonsPeriod[1],
        }

        if (lessonsPeriod[1] < now) {
            let nextSem = out.sem == 1 ? 2 : 1;
            let nextYear = out.sem == 1 ? out.year : out.year + 1;
            let nextLessonsPeriod = await parseCalendar(this.name, nextSem, nextYear);

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
            let pastLessonsPeriod = await parseCalendar(this.name, pastSem, pastYear);

            out.sem = pastSem;
            out.year = pastYear;
            out.lessonsPeriod = pastLessonsPeriod!; // Меня в принципе устраивает и undefined тут
            out.groupInfoTTL = pastLessonsPeriod ? new Date(lessonsPeriod[0].valueOf() - 1000 * 60 * 60 * 24 * 7) : new Date(now.valueOf() + 1000 * 60 * 60 * 12); // однако, undefined всё же закеширую на пол дня
        }

        return out;
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
