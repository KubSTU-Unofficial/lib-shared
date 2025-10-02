import { default as fetchRaw, RequestInit } from 'node-fetch';
import https from 'https';
import { parse } from 'node-html-parser';
import { ILessonSchema } from '../models/LessonModel.js';

const fetch = async (url: string, options: RequestInit = {}, n: number = 3) => {
    try {
        return await fetchRaw(url, options);
    } catch(err) {
        if(n <= 1) throw err;
        return await fetch(url, options, n - 1);
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
    agent: new https.Agent({ rejectUnauthorized: false }),
};

export default class APIConvertor {
    /*
    * Указание, работает ли API. Если false, класс автоматически отправляет undefined со всех методов
    * */
    static isAPIWorks = true;
    private static isAPIWorksTimeout?: NodeJS.Timeout;

    // @ts-ignore
    private static get = async (url: string, options: RequestInit = {}, n: number = 3) => {
        if(!this.isAPIWorks) return undefined;

        try {
            let resp = await fetchRaw(url, options);
            let json = await resp.json();

            // @ts-ignore
            if(!json?.isok && n > 0) return await this.get(url, options, n - 1);

            return json;
        } catch(err) {
            if(n <= 0) {
                console.log(err);

                this.isAPIWorks = false;

                setTimeout(() => { this.isAPIWorks = true; }, 1000 * 60 * 60);

                return undefined;
            }
            return await this.get(url, options, n - 1);
        }
    };

    /*
    * Получает расписание группы на очной форме обучения
    * Ответ форматируется
    * */
    static async ofo(
        gr: string,
        ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
        sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
    ) {
        let json: IAPIResp<IRespOFOPara[]> | undefined = (await this.get(`${process.env.KUBSTU_API}/timetable/ofo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts)) as IAPIResp<IRespOFOPara[]> | undefined;

        if(!json?.isok) {
            console.log('[APIConvertor] Что-то не так!', json, { gr, ugod, sem });

            return undefined;
        }

        let formatedData = json.data.map((elm) => {
            let nElm: ILessonSchema = {
                group: gr,
                day: {
                    nedType: elm.nedtype.nedtype_id == 2,
                    dayOfWeek: elm.dayofweek.dayofweek_id,
                    weeks: {
                        from: elm.ned_from,
                        to: elm.ned_to,
                    },
                },
                number: elm.pair,
                name: elm.disc.disc_name,
                type: elm.kindofnagr.kindofnagr_id,
            };

            if(elm.classroom.trim()) nElm.classroom = elm.classroom;
            if(elm.teacher.trim()) nElm.teacherName = elm.teacher;
            if(elm.ispotok) nElm.isStream = elm.ispotok;
            if(elm.isdistant) nElm.isDistant = elm.isdistant;
            if(elm.comment.trim()) nElm.comment = elm.comment;
            if(elm.persent_of_gr) nElm.percentOfGroup = elm.persent_of_gr;

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
        ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
        sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
    ) {
        let json: IAPIResp<IRespZFOPara[]> | undefined = (await this.get(`${process.env.KUBSTU_API}/timetable/zfo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts)) as IAPIResp<IRespZFOPara[]> | undefined;

        if(!json?.isok) {
            console.log('[APIConvertor] Что-то не так!', json, { gr, ugod, sem });

            return undefined;
        }

        let formatedData = json.data.map((elm) => {
            let nElm: ILessonSchema = {
                group: gr,
                day: {
                    datez: elm.datez,
                },
                number: elm.pair,
                name: elm.disc.disc_name,
                type: elm.kindofnagr.kindofnagr_id,
            };

            if(elm.classroom.trim()) nElm.classroom = elm.classroom;
            if(elm.teacher.trim()) nElm.teacherName = elm.teacher;
            if(elm.comment.trim()) nElm.comment = elm.comment;

            return nElm;
        });

        return { ...json, data: formatedData } as IAPIResp<ILessonSchema[]>;
    }

    /*
    * Возвращает список экзаменов
    * */
    static async exam(
        gr: string,
        ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
        sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
    ) {
        let json: IAPIResp<IRespExam[]> | undefined = (await this.get(`${process.env.KUBSTU_API}/timetable/exam?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts)) as IAPIResp<IRespExam[]> | undefined;

        if(!json?.isok) {
            console.log('[APIConvertor] Что-то не так!', json, { gr, ugod, sem });

            return undefined;
        }

        return json as IAPIResp<IRespExam[]>;
    }

    /*
    * Возвращает список факультетов
    * */
    static async instList() {
        let json: IAPIResp<IRespInst[]> | undefined = (await this.get(`${process.env.KUBSTU_API}/timetable/inst-list`, opts)) as IAPIResp<IRespInst[]> | undefined;

        if(!json?.isok) {
            console.log('[APIConvertor] Что-то не так!', json);

            return undefined;
        }

        return json as IAPIResp<IRespInst[]>;
    }

    /*
    * Возвращает список групп
    * */
    static async groupsList(
        ugod: number | string = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
        filter?: IGroupsListFilter,
    ) {
        let json: IAPIResp<IRespGroup[]> | undefined = (await this.get(`${process.env.KUBSTU_API}/timetable/gr-list?ugod=${ugod}${filter?.inst_id ? `&inst_id=${filter.inst_id}` : ''}${filter?.kurs ? `&kurs=${filter.kurs}` : ''}`, opts)) as IAPIResp<IRespGroup[]> | undefined;

        if(!json?.isok) {
            console.log('[APIConvertor] Что-то не так!', json, {ugod, filter});

            return undefined;
        }

        if(!json.isok) return json;
        // По какой-то причине в API formaob_id=1 не работает, поэтому производим фильтрацию прямо тут

        if(filter?.foe) {
            let f = filter.foe == 'ofo' ? [1] : [2, 3];
            json.data = json.data.filter((g) => f.includes(g.formaob_id));
        }

        return json;
    }
}

/*
Это (надеюсь) временная функция для получения графика с помощью парсинга
*/
export async function parseCalendar(group: string, sem: string | number, ugod: string | number) {
    let url = `https://elkaf.kubstu.ru/timetable/default/time-table-student-ofo?iskiosk=0&gr=${group}&ugod=${ugod}&semestr=${sem}`;

    const res = await fetch(url, {
        headers: {
            'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.0.0 Safari/537.36',
        },
        agent: new https.Agent({ rejectUnauthorized: false }),
    });

    const root = parse(await res.text());

    const elm = root //.querySelector('.container');
    ?.querySelectorAll('p')
    .find((p) => p.text.includes('График занятий:'));

    if(!elm) return undefined;

    let textDate = elm.innerHTML.trim().slice(16, 26);

    if(!textDate) return undefined;

    const [day, month, year] = textDate.split('.').map(Number);

    let date = new Date(year, month - 1, day);

    return isNaN(date.getTime()) ? undefined : date;
}
