import Schedules from '../models/ZScheduleModel.js';
import Groups from '../models/GroupsModel.js';
import APIConvertor, { IRespZFOPara } from '../lib/APIConvertor.js';
import { genToken } from '../lib/Utils.js';
import BaseGroup from './Group.js';
// import ExamsModel from "../models/ExamsModel.js";

export default class BaseZGroup extends BaseGroup<IRespZFOPara> {
    /**
     * Берёт расписание с сайта
     * Если сайт не работает, берёт его с БД
     * Если в БД расписания нет, возвращает undefined
     */
    async getFullRawSchedule() {
        // TODO: Установить дату первой пары как дату начала занятий
        let date = new Date();

        if (this.cachedFullRawSchedule && date.valueOf() - this.cachedFullRawSchedule.updateDate.valueOf() < 1000 * 60 * 60 * 4)
            return this.cachedFullRawSchedule.data;

        let ugod = date.getFullYear() - (date.getMonth() >= 6 ? 0 : 1);
        let sem = date.getMonth() > 5 ? 1 : 2;

        let resp = await APIConvertor.zfo(this.name, ugod, sem);

        if (!resp || !resp.isok) {
            let dbResponse = await Schedules.findOne({ group: this.name }).exec();

            // Если расписание есть в БД, кешируем его только на час
            // Если убрать кеш ответа из БД, бот постоянно биться в неработающий сайт
            if (dbResponse)
                this.cachedFullRawSchedule = {
                    data: dbResponse.data as IRespZFOPara[],
                    updateDate: new Date(date.valueOf() - 1000 * 60 * 60 * 3),
                };

            return dbResponse?.data as IRespZFOPara[] | undefined;
        } else {
            Schedules.findOneAndUpdate({ group: this.name }, { data: resp.data, updateDate: date }, { upsert: true });

            this.cachedFullRawSchedule = {
                data: resp.data,
                updateDate: date,
            };

            return resp.data;
        }
    }

    async getDayRawSchedule(date: Date | number = new Date()) {
        if (typeof date == 'number') throw Error('У ЗФО нельзя смотреть пары по дням недели');

        let fullSchedule = await this.getFullRawSchedule();

        if (!fullSchedule) return undefined;
        else return fullSchedule.filter((p) => p.datez == date.toISOString().slice(0, 10)).sort((a, b) => a.pair - b.pair);
    }

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
