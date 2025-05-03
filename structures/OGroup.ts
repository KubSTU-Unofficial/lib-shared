import BaseGroup from './Group.js';
import { parseCalendar } from '../lib/APIConvertor.js';
import GroupModel from '../models/GroupModel.js';

export default class BaseOGroup extends BaseGroup {
    async getLessonsStartDate(ugod = new Date().getFullYear() - (new Date().getMonth() >= 6 ? 0 : 1), sem = new Date().getMonth() > 5 ? 1 : 2): Promise<Date | undefined> {
        let date = (await GroupModel.findOne({ name: this.name }).lean().exec())?.lessonsStartDate;
        if(!date) {
            date = (await parseCalendar(this.name, sem, ugod));

            if(date) GroupModel.findOneAndUpdate({ name: this.name }, { lessonsStartDate: date }, { upsert: true }).exec();
        }
        return date;
    }

    async getDayRawSchedule(arg1: Date | number = new Date(), week?: boolean) {
        let day: number;

        if(arg1 instanceof Date) {
            day = arg1.getDay();
            week = arg1.getWeek() % 2 == 0;
        } else day = arg1;

        let fullSchedule = await this.getFullRawSchedule();

        if(!fullSchedule) return undefined;
        else
            return fullSchedule
            .filter((p) => 'nedType' in p.day && p.day?.nedType == week && p.day.dayOfWeek == day)
            .sort((a, b) => a.number - b.number);
    }
}
