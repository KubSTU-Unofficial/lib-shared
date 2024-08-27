import TeacherScheduleModel from '../models/TeacherScheduleModel.js';

interface ITeacherLesson {
    group: string;
    number: number;
    time: string;
    name: string;
    paraType: string;
    auditory: string;
    remark?: string;
    percent?: string;
    period?: string;
    flow?: boolean;
}

interface ITeacherDay {
    daynum: number;
    even: boolean;
    daySchedule: ITeacherLesson[];
}

interface ITeacherSchedule {
    days: ITeacherDay[];
    name: string;
    updateDate: Date;
}

export default class BaseTeacher {
    schedule?: ITeacherSchedule;

    async getSchedule(names: string[]) {
        this.schedule = (await TeacherScheduleModel.findOne({
            $or: names.map((n) => {
                return {
                    name: n,
                };
            }),
        }).exec()) as ITeacherSchedule;
    }
}
