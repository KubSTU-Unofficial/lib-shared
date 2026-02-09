// import { parse as parseHtml } from 'node-html-parser';
import { ILessonSchema } from '../models/LessonModel.js';
import { IExam } from '../models/ExamModel.js';
import { parse } from 'date-fns';
import { getCurrentSemesterInfo } from './Utils.js';

const fetchWithRestarts = async (url: string, options: RequestInit = {}, n: number = 3) => {
    try {
        return await fetch(url, options);
    } catch (err) {
        if (n <= 1) throw err;
        return await fetchWithRestarts(url, options, n - 1);
    }
};

interface IAPIResp<T> {
    isok: boolean;
    data: T;
    error_message: string | null;
}

export interface IRespBasePara {
    kindofnagr: {
        kindofnagr_id: number;
        kindofnagr_name: string;
    };
    disc: {
        disc_id: number;
        disc_name: string;
    };
    pair: number;
    classroom: string;
    comment: string;
    teacher: string;
}

export interface IRespOFOPara extends IRespBasePara {
    graph_aud: {
        datestart: string;
        dateend: string;
    }
    nedtype: {
        nedtype_id: number;
        nedtype_name: string;
    };
    dayofweek: {
        dayofweek_id: number;
        dayofweek_name: string;
    };
    ned_from: number;
    ned_to: number;
    persent_of_gr: number;
    ispotok: boolean;
    isdistant: boolean;
}

export interface IRespZFOPara extends IRespBasePara {
    datez: string;
}

interface IRespExam {
    date_sd: string;
    time_sd: string;
    disc: {
        disc_id: number;
        disc_name: string;
    };
    classroom: string;
    teacher: string;
}

interface IRespInst {
    id: number;
    name: string;
    fname: string;
}

interface IRespGroup {
    id: number;
    name: string;
    inst_id: number;
    formaob_id: number;
    kurs: number;
}

export interface IGroupShort {
    name: string;
    fakId: number;
    FoE: FoE;
}

export enum FoE { // Form Of Education
    ofo = 1,
    ozfo,
    zfo,
}

export enum LessonTypes {
    'Лекции' = 1,
    'Практические занятия',
    'Лабораторные занятия',
}

export enum LessonTypesShorted {
    'Лекция' = 1,
    'Практика',
    'Лабораторная',
}

interface IGroupsListFilter {
    inst_id?: string | number;
    kurs?: string | number;
    foe?: 'ofo' | 'zfo';
}

const opts = {
    headers: {
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
    },
};

export default class APIConvertor {
    /*
    * Указание, работает ли API. Если false, класс автоматически отправляет undefined со всех методов
    * */
    static isAPIWorks = true;
    // private static isAPIWorksTimeout?: NodeJS.Timeout;

    // Чтобы не закидывать API сотнями запросов в секунду были установлены ограничения
    private static maxConcurrent = 8;
    private static inFlight = 0;
    private static queue: (() => void)[] = [];

    private static async acquire() {
        if (this.inFlight < this.maxConcurrent) {
            this.inFlight++;
            return;
        }

        await new Promise<void>(resolve => this.queue.push(resolve));
        this.inFlight++;
    }

    private static release() {
        this.inFlight--;
        const next = this.queue.shift();
        if (next) next();
    }

    static async get<T>(url: string, options: RequestInit = {}, n = 3) {
        if (!this.isAPIWorks) return undefined;

        await this.acquire();
        try {
            return await this._getInternal<T>(url, options, n);
        } finally {
            this.release();
        }
    }

    private static async _getInternal<T>(url: string, options: RequestInit = {}, n: number = 3): Promise<IAPIResp<T> | undefined> {
        if (!this.isAPIWorks) return undefined;

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10_000); // 10 сек

        try {
            let resp = await fetch(url, { ...options, signal: controller.signal });
            let json: IAPIResp<T> = (await resp.json()) as IAPIResp<T>;

            if (!json?.isok && n > 0) return await this._getInternal(url, options, n - 1);

            return json;
        } catch (err) {
            if (n <= 0) {
                console.log(`[APIConvertor] API DEAD!`);

                console.log(err);

                this.isAPIWorks = false;

                setTimeout(() => { this.isAPIWorks = true; }, 1000 * 60 * 60);

                return undefined;
            }
            return await this._getInternal(url, options, n - 1);
        } finally {
            clearTimeout(timeout);
        }
    }

    /*
    * Получает расписание группы на очной форме обучения
    * Ответ форматируется
    * */
    static async ofo(
        gr: string,
        ugod: string | number = getCurrentSemesterInfo().year,
        sem: string | number = getCurrentSemesterInfo().semester,
    ) {
        const json = await this.get<IRespOFOPara[]>(`${process.env.KUBSTU_API}/timetable/ofo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts);

        if (!json?.isok) {
            console.log('[APIConvertor] [ofo] Неправильный вывод', json, { gr, ugod, sem });

            return undefined;
        }

        let formatedData = json.data.map((elm) => {
            let nElm: ILessonSchema = {
                group: gr,
                name: elm.disc.disc_name,
                type: elm.kindofnagr.kindofnagr_id,
                timing: {
                    year: +ugod,
                    semester: Number(sem) as 1 | 2,
                    lessonNumber: elm.pair,

                    weeks: {
                        from: elm.ned_from,
                        to: elm.ned_to,

                        startDate: new Date(elm.graph_aud.datestart), // Потенцивально опасный момент, если elm.graph_aud.datestart не будет задан или будет задан неправильно
                        endDate: new Date(elm.graph_aud.dateend),

                        type: elm.nedtype.nedtype_id == 2,
                        dayOfWeek: elm.dayofweek.dayofweek_id,
                    },
                },
            };

            if (elm.teacher.trim()) nElm.teacherName = elm.teacher;
            if (elm.classroom.trim()) nElm.classroom = elm.classroom;
            if (elm.persent_of_gr) nElm.percentOfGroup = elm.persent_of_gr;
            if (elm.ispotok) nElm.isStream = elm.ispotok;
            if (elm.isdistant) nElm.isDistant = elm.isdistant;
            if (elm.comment.trim()) nElm.comment = elm.comment;

            return nElm;
        });

        return { ...json, data: formatedData } as IAPIResp<ILessonSchema[]>;
    }

    /*
    * Получает расписание группы на заочной форме обучения
    * Ответ форматируется
    * */
    static async zfo(
        gr: string,
        ugod: string | number = getCurrentSemesterInfo().year,
        sem: string | number = getCurrentSemesterInfo().semester,
    ) {
        const json = await this.get<IRespZFOPara[]>(`${process.env.KUBSTU_API}/timetable/zfo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts);

        if (!json?.isok) {
            console.log('[APIConvertor] [zfo] Неправильный вывод', { json, gr, ugod, sem });

            return undefined;
        }

        let formatedData = json.data.map((elm) => {
            let nElm: ILessonSchema = {
                group: gr,
                name: elm.disc.disc_name,
                type: elm.kindofnagr.kindofnagr_id,

                timing: {
                    year: +ugod,
                    semester: Number(sem) as 1 | 2,
                    lessonNumber: elm.pair,
                    date: parse(elm.datez, 'yyyy-MM-dd', new Date()),
                },
            };

            if (elm.classroom.trim()) nElm.classroom = elm.classroom;
            if (elm.teacher.trim()) nElm.teacherName = elm.teacher;
            if (elm.comment.trim()) nElm.comment = elm.comment;

            return nElm;
        });

        return { ...json, data: formatedData } as IAPIResp<ILessonSchema[]>;
    }

    /*
    * Возвращает список экзаменов
    * Ответ форматируется
    * */
    static async exam(
        gr: string,
        ugod: string | number = getCurrentSemesterInfo().year,
        sem: string | number = getCurrentSemesterInfo().semester,
    ) {
        let json = await this.get<IRespExam[]>(`${process.env.KUBSTU_API}/timetable/exam?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts);

        if (!json?.isok) {
            console.log('[APIConvertor] [exam] Неправильный вывод', { json, gr, ugod, sem });

            return undefined;
        }

        return {
            ...json,
            data: json.data.map((e) => ({
                group: gr,
                name: e.disc.disc_name,
                date: parse(`${e.date_sd} ${e.time_sd}`, 'yyyy-MM-dd HH:mm:ss', new Date()),
                classroom: e.classroom,
                teacher: e.teacher,
                year: ugod,
                semester: sem,
            }))
        } as IAPIResp<IExam[]>;
    }

    /*
    * Возвращает список факультетов
    * */
    static async instList() {
        let json = await this.get<IRespInst[]>(`${process.env.KUBSTU_API}/dic/inst-list`, opts);

        if (!json?.isok) {
            console.log('[APIConvertor] [inst-list] Неправильный вывод', json);
            return undefined;
        }

        return json;
    }

    /*
    * Возвращает список групп
    * */
    static async groupsList(
        ugod: number | string = getCurrentSemesterInfo().year,
        filter?: IGroupsListFilter,
    ) {
        let json = await this.get<IRespGroup[]>(`${process.env.KUBSTU_API}/dic/gr-list?ugod=${ugod}${filter?.inst_id ? `&inst_id=${filter.inst_id}` : ''}${filter?.kurs ? `&kurs=${filter.kurs}` : ''}`, opts);

        if (!json?.isok) {
            console.log('[APIConvertor] [gr-list] Неправильный вывод', json, { ugod, filter });
            return undefined;
        }
        // В API появилась фильтрация по formaob_id, но выбрать ЗФО там нельзя (тк есть ЗФО и ОЗФО, но вторые обрабатываются так же как и ЗФО). Проще отфильтровать тут

        if (filter?.foe) {
            let f = filter.foe === 'ofo' ? [FoE.ofo] : [FoE.ozfo, FoE.zfo];
            json.data = json.data.filter((g) => f.includes(g.formaob_id));
        }

        return {
            ...json,
            data: json.data.map((e) => ({ name: e.name, fakId: e.inst_id, FoE: e.formaob_id as FoE }))
        } as IAPIResp<IGroupShort[]>;
    }
}
