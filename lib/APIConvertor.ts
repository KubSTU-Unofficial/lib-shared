import fetch from 'node-fetch';
import https from 'https';

interface IAPIResp<T> {
    isok: boolean;
    data: T;
    error_message: string | null;
}

export interface IRespOFOPara {
    nedtype: {
        nedtype_id: number;
        nedtype_name: string;
    };
    dayofweek: {
        dayofweek_id: number;
        dayofweek_name: string;
    };
    pair: number;
    kindofnagr: {
        kindofnagr_id: number;
        kindofnagr_name: string;
    };
    disc: {
        disc_id: number;
        disc_name: string;
    };
    ned_from: number;
    ned_to: number;
    persent_of_gr: number;
    ispotok: boolean;
    classroom: string;
    isdistant: boolean;
    teacher: string;
    comment: string;
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

    if (resp) {
        let json: IAPIResp<IRespOFOPara[]> = (await resp.json()) as IAPIResp<IRespOFOPara[]>;

        json.data.map((elm) => {
            if (!elm.teacher.trim()) elm.teacher = 'Не назначен';
            if (!elm.classroom.trim()) elm.teacher = 'Не назначена';

            return elm;
        });

        return json;
    } else return undefined;
}

export async function exam(
    gr: string,
    ugod: string | number = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    sem: string | number = new Date().getMonth() > 5 ? 1 : 2,
) {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/exam?gr=${gr}&ugod=${ugod}&semestr=${sem}`, opts).catch(console.log);

    if (resp) return (await resp.json()) as IAPIResp<IRespExam[]>;
    else return undefined;
}

export async function instList() {
    let resp = await fetch(`${process.env.KUBSTU_API}/timetable/inst-list`, opts).catch(console.log);

    if (resp) return (await resp.json()) as IAPIResp<IRespInst[]>;
    else return undefined;
}

export async function ofoGroupsList(
    ugod: number | string = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1),
    inst_id?: string | number,
    kurs?: string | number,
) {
    let resp = await fetch(
        `${process.env.KUBSTU_API}/timetable/gr-list?ugod=${ugod}&formaob_id=1${inst_id ? `&inst_id=${inst_id}` : ''}${inst_id ? `&kurs=${kurs}` : ''}`,
        opts,
    ).catch(console.log);

    if (resp) {
        let json = (await resp.json()) as IAPIResp<IRespGroup[]>;

        if (!json.isok) return json;
        // Из-за какого-то бага, formaob_id=1 не работает, поэтому производим фильтрацию прямо тут
        json.data = json.data.filter((g) => g.formaob_id == 1);

        return json;
    } else return undefined;
}

export default {
    ofo,
    exam,
    instList,
    ofoGroupsList,
};
