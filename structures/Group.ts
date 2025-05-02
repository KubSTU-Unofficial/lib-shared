import APIConvertor, { LessonTypes } from '../lib/APIConvertor.js';
import LessonModel, { ILesson } from '../models/LessonModel.js';
import GroupModel from '../models/GroupModel.js';
import { genToken } from '../lib/Utils.js';

export default abstract class BaseGroup {
    kurs: number;
    cachedFullRawSchedule?: {
        data: ILesson[];
        lessonsStartDate?: Date;
        updateDate: Date;
    };

    static lessonsTime: string[][] = [
        ['wh', 'at?'],
        ['8:00', '9:30'],
        ['9:40', '11:10'],
        ['11:20', '12:50'],
        ['13:20', '14:50'],
        ['15:00', '16:30'],
        ['16:40', '18:10'],
        ['18:20', '19:50'],
        ['20:00', '21:30'],
    ];

    constructor(
        public name: string,
        public instId: number,
    ) {
        let year = +(name[0] + name[1]);
        let now = new Date();

        this.kurs = now.getUTCFullYear() - 2000 - (now.getUTCMonth() >= 6 ? 0 : 1) - year + 1; // FIXME: Будет работать до 2100 года
    }

    abstract getLessonsStartDate(ugod?: number, sem?: number): Promise<Date | undefined>

    /**
     * Берёт расписание с сайта и обновляет его в БД
     * Если сайт не работает, берёт расписание с БД
     * Если в БД расписания нет, возвращает undefined
     */
    async getFullRawSchedule() {
        let date = new Date();

        if (this.cachedFullRawSchedule && date.valueOf() - this.cachedFullRawSchedule.updateDate.valueOf() < 1000 * 60 * 60 * 4)
            return this.cachedFullRawSchedule.data;

        let resp = this.isZFOGroup() ? await APIConvertor.zfo(this.name) : await APIConvertor.ofo(this.name);
        let lessonsStartDate = this.cachedFullRawSchedule?.lessonsStartDate ?? await this.getLessonsStartDate();

        if (!resp || !resp.isok) {
            let dbResponse = await LessonModel.find({ group: this.name }).exec();

            // Если расписание есть в БД, кешируем его только на час
            // Если убрать кеш ответа из БД, бот постоянно биться в неработающий сайт
            if (dbResponse)
                this.cachedFullRawSchedule = {
                    data: dbResponse as ILesson[],
                    updateDate: new Date(date.valueOf() - 1000 * 60 * 60 * 3),
                    lessonsStartDate,
                };

            return dbResponse as ILesson[] | undefined;
        } else {
            if(!this.isZFOGroup() && lessonsStartDate) resp.data.map((elm) => {
                if('nedType' in elm.day) elm.day.weeks.startDate = new Date(lessonsStartDate.valueOf() + 1000 * 60 * 60 * 24 * 7 * (elm.day.weeks.from - 1));
                return elm;
            });

            this.updateShedule(resp.data).catch(console.log);

            this.cachedFullRawSchedule = {
                data: resp.data,
                updateDate: date,
                lessonsStartDate,
            };

            return resp.data;
        }
    }

    async updateShedule(newSchedule: ILesson[]) {
        await LessonModel.deleteMany({ group: this.name }).exec();

        return await LessonModel.insertMany(
            newSchedule.map(lesson => ({
                ...lesson,
                group: this.name,
            }))
        );
    }

    abstract getDayRawSchedule(date: Date): Promise<ILesson[] | undefined>;
    abstract getDayRawSchedule(day: number, week: boolean): Promise<ILesson[] | undefined>;

    abstract getDayRawSchedule(day: Date | number, week?: boolean): Promise<ILesson[] | undefined>;

    async getRawTeachersList(): Promise<string[]> {
        let schedule = await this.getFullRawSchedule();
        let teachers: string[] = [];

        if (schedule) {
            schedule.forEach((lesson) => {
                if (lesson.teacherName && !teachers.includes(lesson.teacherName!)) teachers.push(lesson.teacherName!);
            });
        }

        return teachers;
    }

    async getRawTeachersAndDisciplines() {
        let schedule = await this.getFullRawSchedule();
        let lessons: { [key: string]: { [key: string]: string[] } } = {};

        if (schedule) {
            schedule.forEach((lesson) => {
                if (!lessons[lesson.name]) lessons[lesson.name] = {};
                if (!lessons[lesson.name][lesson.teacherName ?? 'Не назначен']) lessons[lesson.name][lesson.teacherName ?? 'Не назначен'] = [];
                if (!lessons[lesson.name][lesson.teacherName ?? 'Не назначен'].includes(LessonTypes[lesson.type]))
                    lessons[lesson.name][lesson.teacherName ?? 'Не назначен'].push(LessonTypes[lesson.type]);
            });
        }

        return lessons;
    }

    static isZFOGroup(name: string) {
        return /^[^\\-]+-(АЗ|З|ОЗ)[^-]*-/.test(name);
    }

    isZFOGroup() {
        return BaseGroup.isZFOGroup(this.name);
    }

    async getToken(): Promise<string> {
        let groupInfo = await GroupModel.findOne({ group: this.name, inst_id: this.instId }).exec();

        if (groupInfo && groupInfo.token) return groupInfo.token;
        else {
            let token = genToken(this.name, this.instId);

            new GroupModel({
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
