import Schedules from '../models/OScheduleModel.js';
import Groups from '../models/GroupsModel.js';
import APIConvertor, { IRespOFOPara, parseCalendar } from '../lib/APIConvertor.js';
import { genToken } from '../lib/Utils.js';
import BaseGroup from './Group.js';
// import ExamsModel from "../models/ExamsModel.js";

export default class BaseOGroup extends BaseGroup<IRespOFOPara> {
    /**
     * Берёт расписание с сайта
     * Если сайт не работает, берёт его с БД
     * Если в БД расписания нет, возвращает undefined
     */
    async getFullRawSchedule() {
        let date = new Date();

        if (this.cachedFullRawSchedule && date.valueOf() - this.cachedFullRawSchedule.updateDate.valueOf() < 1000 * 60 * 60 * 4)
            return this.cachedFullRawSchedule.data;

        let ugod = date.getFullYear() - (date.getMonth() >= 6 ? 0 : 1);
        let sem = date.getMonth() > 5 ? 1 : 2;

        let resp = await APIConvertor.ofo(this.name, ugod, sem);

        if (!resp || !resp.isok) {
            let dbResponse = await Schedules.findOne({ group: this.name }).exec();

            // Если расписание есть в БД, кешируем его только на час
            // Если убрать кеш ответа из БД, бот постоянно биться в неработающий сайт
            if (dbResponse)
                this.cachedFullRawSchedule = {
                    data: dbResponse.data as IRespOFOPara[],
                    lessonsStartDate: dbResponse.lessonsStartDate! ?? this.cachedFullRawSchedule?.lessonsStartDate,
                    updateDate: new Date(date.valueOf() - 1000 * 60 * 60 * 3),
                };

            return dbResponse?.data as IRespOFOPara[] | undefined;
        } else {
            Schedules.findOneAndUpdate({ group: this.name }, { data: resp.data, updateDate: date }, { upsert: true });

            this.cachedFullRawSchedule = {
                data: resp.data,
                lessonsStartDate: this.cachedFullRawSchedule?.lessonsStartDate ?? (await parseCalendar(this.name, sem, ugod)),
                updateDate: date,
            };

            return resp.data;
        }
    }

    async getDayRawSchedule(arg1: Date | number = new Date(), week?: boolean) {
        let day: number;

        if (arg1 instanceof Date) {
            day = arg1.getDay();
            week = arg1.getWeek() % 2 == 0;
        } else day = arg1;

        let fullSchedule = await this.getFullRawSchedule();

        if (!fullSchedule) return undefined;
        else
            return fullSchedule
                .filter((p) => p.nedtype.nedtype_id == (week ? 2 : 1) && p.dayofweek.dayofweek_id == day)
                .sort((a, b) => a.pair - b.pair);
    }

    // async getLessonsStartDate() {
    //     let date = new Date();
    //     let ugod = date.getFullYear() - (date.getMonth() >= 6 ? 0 : 1);
    //     let sem = date.getMonth() > 5 ? 1 : 2;

    //     return this.cachedFullRawSchedule?.lessonsStartDate ?? (await parseCalendar(this.name, sem, ugod));
    // }

    async getToken(): Promise<string> {
        let groupInfo = await Groups.findOne({ group: this.name, inst_id: this.instId }).exec();

        if (groupInfo) return groupInfo.token;
        else {
            let token = genToken(this.name, this.instId);

            new Groups({
                group: this.name,
                inst_id: this.instId,
                token,
            })
                .save()
                .catch(console.log);

            return token;
        }
    }
}
