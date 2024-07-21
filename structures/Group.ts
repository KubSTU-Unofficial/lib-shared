import Schedules from "../models/ScheduleModel.js";
import Groups from "../models/GroupsModel.js";
import APIConvertor from "../lib/APIConvertor.js";
import { genToken } from "../lib/Utils.js";
// import ExamsModel from "../models/ExamsModel.js";

export default class BaseGroup {
    kurs: number;
    cachedFullRawSchedule?: {
        data: IRespOFOPara[],
        updateDate: Date
    };
    
    static lessonsTime: string[] = ["what?", "8:00 - 9:30", "9:40 - 11:10", "11:20 - 12:50", "13:20 - 14:50", "15:00 - 16:30", "16:40 - 18:10", "18:20 - 19:50"];
    static lessonsTypes: {[key:string]: string} = {
        "Лекции": "Лекция",
        "Практические занятия": "Практика",
        "Лабораторные занятия": "Лабораторная"
    };

    constructor(public name: string, public instId: number) {
        let year = +(name[0]+name[1]);
        let now  = new Date();

        this.kurs    = now.getUTCFullYear() - 2000 - (now.getUTCMonth() >= 6 ? 0 : 1) - year + 1; // FIXME: Будет работать до 2100 года
    }

    /**
     * Берёт расписание с сайта
     * Если сайт не работает, берёт его с БД
     * Если в БД расписания нет, возвращает undefined
     */
    async getFullRawSchedule() {
        let date  = new Date();

        if(this.cachedFullRawSchedule && date.valueOf() - this.cachedFullRawSchedule.updateDate.valueOf() < 1000 * 60 * 60 * 4) return this.cachedFullRawSchedule.data;
        
        let ugod  = date.getFullYear() - (date.getMonth() >= 6 ? 0 : 1);
        let sem   = date.getMonth() > 5 ? 1 : 2;

        let resp = await APIConvertor.ofo(this.name, ugod, sem);

        if(!resp || !resp.isok) {
            let dbResponse = await Schedules.findOne({ group: this.name }).exec();

            // Если расписание есть в БД, кешируем его только на час
            // Если убрать кеш ответа из БД, бот постоянно биться в неработающий сайт
            if(dbResponse) this.cachedFullRawSchedule = {
                data: dbResponse.data as IRespOFOPara[],
                updateDate: new Date(date.valueOf() - 1000*60*60*3)
            };

            return dbResponse?.data as IRespOFOPara[] | undefined;
        } else {
            Schedules.findOneAndUpdate({ group: this.name }, { data: resp.data, updateDate: date }, { upsert: true });

            this.cachedFullRawSchedule = { data: resp.data, updateDate: date };

            return resp.data;
        }
    }

    async getDayRawSchedule(day = new Date().getDay(), week = (new Date().getWeek()%2==0)) {
        let fullSchedule = await this.getFullRawSchedule();

        if(!fullSchedule) return undefined;
        else return fullSchedule
        .filter(p => p.nedtype.nedtype_id == (week ? 2 : 1) && p.dayofweek.dayofweek_id == day)
        .sort((a,b) => a.pair - b.pair);
    }
    
    async getToken():Promise<string> {
        let groupInfo = await Groups.findOne({group: this.name, inst_id: this.instId}).exec();

        if(groupInfo) return groupInfo.token;
        else {
            let token = genToken(this.name, this.instId);

            new Groups({
                group: this.name,
                inst_id: this.instId,
                token
            }).save().catch(console.log);

            return token;
        }
    }
}