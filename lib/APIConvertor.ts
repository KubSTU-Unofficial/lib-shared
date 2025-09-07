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

export async function ofo(
    gr: string,
    ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
) {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/ofo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts).catch(console.log);

    if(resp) {
        let json: IAPIResp<IRespOFOPara[]> = (await resp.json()) as IAPIResp<IRespOFOPara[]>;

        if(!json || !json.isok || !json.data) {
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
    } else return undefined;
}

export async function zfo(
    gr: string,
    ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
) {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/zfo?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts).catch(console.log);

    if(resp) {
        let json: IAPIResp<IRespZFOPara[]> = (await resp.json()) as IAPIResp<IRespZFOPara[]>;

        if(!json || !json.isok || !json.data) {
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
    } else return undefined;
}

export async function exam(
    gr: string,
    ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
) {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/exam?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts).catch(console.log);

    if(resp) return (await resp.json()) as IAPIResp<IRespExam[]>;
    else return undefined;
}

export async function instList() {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/inst-list`, opts).catch(console.log);

    if(resp) return (await resp.json()) as IAPIResp<IRespInst[]>;
    else return undefined;
}

export async function groupsList(
    ugod: number | string = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    filter?: IGroupsListFilter,
) {
    let resp = await fetch(
        `${process.env.KUBSTU_API}/timetable/gr-list?ugod=${ugod}${filter?.inst_id ? `&inst_id=${filter.inst_id}` : ''}${filter?.inst_id ? `&kurs=${filter.kurs}` : ''}`,
        opts,
    ).catch(console.log);

    if(resp) {
        let json = (await resp.json()) as IAPIResp<IRespGroup[]>;

        if(!json.isok) return json;
        // По какой-то причине в API formaob_id=1 не работает, поэтому производим фильтрацию прямо тут

        if(filter?.foe) {
            let f = filter.foe == 'ofo' ? [1] : [2, 3];
            json.data = json.data.filter((g) => f.includes(g.formaob_id));
        }

        return json;
    } else return undefined;
}

/*
Это (надеюсь) временный метод для получения графика с помощью парсинга
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

    let elm = root //.querySelector('.container');
    ?.querySelectorAll('p')
    .find((p) => p.text.includes('График занятий:'));

    let textDate = elm?.innerHTML.trim().slice(16, 26);

    if(!textDate) return undefined;

    const [day, month, year] = textDate.split('.').map(Number);

    let date = new Date(year, month - 1, day);

    return isNaN(date.getTime()) ? undefined : date;
}

export default {
    ofo,
    zfo,
    exam,
    instList,
    groupsList,
    parseCalendar,
};
