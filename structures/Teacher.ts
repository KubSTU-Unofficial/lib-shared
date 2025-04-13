import TeacherScheduleModel from '../models/TeacherScheduleModel.js';

export interface ITeacherLesson {
    group: string;
    number: number;
    time: string;
    name: string;
    paraType: string;
    auditory: string;
    period?: [number, number];
    remark?: string;
    percent?: string;
    flow?: boolean;
}

export interface ITeacherDay {
    daynum: number;
    even: boolean;
    daySchedule: ITeacherLesson[];
}

export interface ITeacherSchedule {
    days: ITeacherDay[];
    name: string;
    updateDate: Date;
}

export default class BaseTeacher {
    schedule?: ITeacherSchedule | null;

    async getSchedule(names: string[]) {
        this.schedule = await TeacherScheduleModel.findOne({
            $or: names.map((n) => ({ name: n })),
        }).exec();
    }
}
