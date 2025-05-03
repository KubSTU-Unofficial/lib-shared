import BaseGroup from './Group.js';
import GroupModel from '../models/GroupModel.js';
import { ILessonSchema } from '../models/LessonModel.js';

export default class BaseZGroup extends BaseGroup {
    async getLessonsStartDate(): Promise<Date | undefined> {
        let date = (await GroupModel.findOne({ name: this.name }).lean().exec())?.lessonsStartDate;

        if(!date && this.cachedFullRawSchedule?.data?.length) {
            const earliest = this.cachedFullRawSchedule.data.reduce((earliest, current) => {
                if(!earliest) return current;
                if('datez' in current.day && 'datez' in earliest.day) return (!earliest || new Date(current.day.datez) < new Date(earliest?.day.datez)) ? current : earliest;
                else return earliest;
            }, undefined as unknown as ILessonSchema);

            if('datez' in earliest.day) date = new Date(earliest.day.datez);

            GroupModel.findOneAndUpdate({ name: this.name }, { lessonsStartDate: date }, { upsert: true }).exec();
        }

        if(date === null) date = undefined;

        return date;
    }

    async getDayRawSchedule(date: Date | number = new Date()) {
        if(typeof date == 'number') throw Error('У ЗФО нельзя смотреть пары по дням недели');

        let fullSchedule = await this.getFullRawSchedule();

        if(!fullSchedule) return undefined;
        else return fullSchedule
        .filter((p) => 'datez' in p.day && p.day.datez == date.toISOString().slice(0, 10))
        .sort((a, b) => a.number - b.number);
    }
}
