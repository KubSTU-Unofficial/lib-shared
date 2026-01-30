import { FoE, LessonTypes } from '../lib/APIConvertor';
import LessonModel, { ILessonSchema } from '../models/LessonModel';
import GroupModel from '../models/GroupModel';
import APIConvertor from '../lib/APIConvertor';
import ExamModel, { IExam } from '../models/ExamModel';
// import { genToken } from '../lib/Utils';

export interface IGroupInfo {
    sem: number;
    year: number;
    lessonsPeriod?: Date[];
    groupInfoTTL: Date;
}

export default abstract class Group {
    kurs: number;

    cache: {
        timetable?: ILessonSchema[];
        timetableTTL?: Date;

        sem?: number;
        year?: number;
        lessonsPeriod?: Date[];
        groupInfoTTL?: Date;

        exams?: IExam[];
        examsTTL?: Date;
    } = {};

    // Форма обучения
    FoE?: FoE;

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

        this.kurs = now.getUTCFullYear() - 2000 - (now.getUTCMonth() >= 6 ? 0 : 1) - year + 1; // Будет работать до 2100 года
    }

    async init() {
        await this.getAndStoreGroupInfo();
        await this.getAndStoreFullTimetable();
        return this;
    }

    /*
     * Получает информацию о группе (семестр, год, период), сначала из кеша, потом из API, БД, из истёкшего кеша. Если информации о группе нигде нет, вернёт undefined.
     * */
    async getGroupInfo(): Promise<IGroupInfo> {
        return this.getGroupInfoFromCache() ?? await this.getGroupInfoFromAPI() ?? await this.getGroupInfoFromDb() ?? this.getGroupInfoFromCache(true) ?? this.getGroupInfoDefault();
    }

    async getAndStoreGroupInfo() {
        let gi = this.getGroupInfoFromCache()

        if (gi) return gi;

        gi = await this.getGroupInfoFromAPI();

        if (gi) {
            this.sendGroupInfoToDb(gi);
            this.sendGroupInfoToCache(gi);

            return gi;
        }

        gi = await this.getGroupInfoFromDb();

        if (gi) {
            this.sendGroupInfoToCache(gi);
            return gi
        }

        gi = this.getGroupInfoFromCache(true);

        if (gi) {
            this.sendGroupInfoToCache(gi, new Date(Date.now() + 1000 * 60 * 60 * 24));
            return gi;
        }

        gi = this.getGroupInfoDefault();

        this.sendGroupInfoToCache(gi)

        return gi;
    }

    abstract getGroupInfoFromAPI(): Promise<IGroupInfo | undefined>

    /*
     * Получает информацию о группе (семестр, год, период) из БД
     * */
    async getGroupInfoFromDb(): Promise<IGroupInfo | undefined> {
        let groupInfo = await GroupModel.findOne({ name: this.name }).lean().exec();

        if (!groupInfo) return undefined;

        let out: IGroupInfo = {
            sem: groupInfo.sem,
            year: groupInfo.year,
            groupInfoTTL: undefined! // Будет 100% задано двумя строками ниже
        }

        if (groupInfo.lessonsStartDate && groupInfo.lessonsEndDate) out.lessonsPeriod = [groupInfo.lessonsStartDate, groupInfo.lessonsEndDate]
        out.groupInfoTTL = groupInfo.lessonsEndDate ?? new Date(Date.now().valueOf() + 1000 * 60 * 60 * 24 * 7);

        return out;
    }

    getGroupInfoFromCache(ignoreTTL = false): IGroupInfo | undefined {
        if (!this.cache.groupInfoTTL || (this.cache.groupInfoTTL < new Date() && !ignoreTTL)) return undefined;

        return {
            sem: this.cache.sem!,
            year: this.cache.year!,
            lessonsPeriod: this.cache.lessonsPeriod!,
            groupInfoTTL: this.cache.groupInfoTTL,
        }
    }

    getGroupInfoDefault(): IGroupInfo {
        let now = new Date();
        let defaultYear = now.getFullYear() - (now.getMonth() >= 6 ? 0 : 1);
        let defaultSem = now.getMonth() > 5 ? 1 : 2;

        return {
            sem: defaultSem,
            year: defaultYear,
            groupInfoTTL: new Date(Date.now().valueOf() + 1000 * 60 * 60 * 24 * 7),
        }
    }

    sendGroupInfoToDb(data: IGroupInfo) {
        let out: any = {
            sem: data.sem, year: data.year,
        }

        if (data.lessonsPeriod) {
            out.lessonsStartDate = data.lessonsPeriod[0];
            out.lessonsEndDate = data.lessonsPeriod[1];
        }

        return GroupModel.updateOne(
            { name: this.name },
            { $set: out }
        ).exec();
    }

    sendGroupInfoToCache(data: IGroupInfo, ttl?: Date) {
        this.cache.sem = data.sem;
        this.cache.year = data.year;
        if (data.lessonsPeriod) this.cache.lessonsPeriod = data.lessonsPeriod;
        this.cache.groupInfoTTL = ttl ?? data.groupInfoTTL ?? data.lessonsPeriod?.[1] ?? new Date(Date.now().valueOf() + 1000 * 60 * 60 * 24 * 7);
    }

    abstract getTimetable(opts?: { year?: number, sem?: number, date?: Date, day?: number, week?: boolean }): Promise<ILessonSchema[] | undefined>

    async getFullTimetable(): Promise<ILessonSchema[] | undefined>;
    async getFullTimetable(year: number, sem: number): Promise<ILessonSchema[] | undefined>;

    async getFullTimetable(year?: number, sem?: number): Promise<ILessonSchema[] | undefined> {
        if (!year && !sem) {
            let groupInfo = await this.getGroupInfo();

            year = groupInfo.year;
            sem = groupInfo.sem;

            return this.getTimetableFromCache() ?? await this.getTimetableFromAPI(year, sem) ?? await this.getTimetableFromDb(year, sem) ?? this.getTimetableFromCache(false);
        } else {
            return await this.getTimetableFromDb(year, sem) ?? await this.getTimetableFromAPI(year, sem);
        }
    }

    async getAndStoreFullTimetable(): Promise<ILessonSchema[] | undefined>;
    async getAndStoreFullTimetable(year: number, sem: number): Promise<ILessonSchema[] | undefined>;

    async getAndStoreFullTimetable(year?: number, sem?: number) {
        if (!year && !sem) {
            let tt = this.getTimetableFromCache();

            if (tt) return tt;

            let groupInfo = await this.getGroupInfo();

            year = groupInfo.year;
            sem = groupInfo.sem;
            tt = await this.getTimetableFromAPI(year, sem);

            if (tt) {
                this.sendTimetableToCache(tt);
                this.sendTimetableToDb(tt);

                return tt;
            }

            tt = await this.getTimetableFromDb(year, sem);

            if (tt) {
                this.sendTimetableToCache(tt)

                return tt;
            }

            return this.getTimetableFromCache(true);
        } else {
            let tt = await this.getTimetableFromDb(year, sem);

            if (tt) return tt;

            tt = await this.getTimetableFromAPI(year, sem);

            if (tt) {
                this.sendTimetableToDb(tt);
                return tt;
            }

            return undefined;
        }
    }

    abstract getTimetableFromAPI(): Promise<ILessonSchema[] | undefined>
    abstract getTimetableFromAPI(year: number, sem: number): Promise<ILessonSchema[] | undefined>

    /*
     * Возвращает расписание из API
     * */
    abstract getTimetableFromAPI(year?: number, sem?: number): Promise<ILessonSchema[] | undefined>;

    async getTimetableFromDb(year?: number, sem?: number): Promise<ILessonSchema[] | undefined> {
        if (!year && !sem) {
            let groupInfo = await this.getGroupInfo();

            year = groupInfo.year;
            sem = groupInfo.sem;
        }

        return LessonModel.find({
            group: this.name,
            "timing.year": year,
            "timing.semester": sem,
        }).lean().exec();
    }

    getTimetableFromCache(ignoreTTL = false) {
        if (!this.cache.timetableTTL || !this.cache.timetable || (!ignoreTTL && this.cache.timetableTTL < new Date())) return undefined;

        return this.cache.timetable!
    }

    async sendTimetableToDb(newSchedule: ILessonSchema[]) {
        if (!newSchedule.length) return;
        let year = newSchedule[0].timing.year;
        let sem = newSchedule[0].timing.semester;

        // TODO: Для большей надежности в будущем это стоит обернуть в транзакцию
        try {
            await LessonModel.deleteMany({ group: this.name, "timing.year": year, "timing.semester": sem }).exec();
            await LessonModel.insertMany(newSchedule);
        } catch (error) {
            console.error(`Failed to update schedule for group ${this.name}:`, error);
        }
    }

    sendTimetableToCache(data: ILessonSchema[], ttl?: Date) {
        this.cache.timetable = data;
        this.cache.timetableTTL = ttl ?? new Date(Date.now() + 1000 * 60 * 60 * 24);
    }

    async getExams() {
        return this.getExamsFromCache() ?? await this.getExamsFromApi() ?? await this.getExamsFromDb() ?? this.getExamsFromCache(true);
    }

    async getAndStoreExams() {
        let e = this.getExamsFromCache();
        if (e) return e;

        e = await this.getExamsFromApi();
        if (e) {
            this.sendExamsToDb(e);
            this.sendExamsToCache(e);

            return e;
        }

        e = await this.getExamsFromDb();
        if (e) {
            this.sendExamsToCache(e);

            return e;
        }

        return this.getExamsFromCache(true);
    }

    async getExamsFromApi() {
        let groupInfo = await this.getAndStoreGroupInfo();
        if (!groupInfo) return undefined;

        let year = groupInfo.year;
        let sem = groupInfo.sem;
        let result = await APIConvertor.exam(this.name, year, sem);

        if (!result?.isok || !result?.data) return undefined;

        return result.data;
    }

    async getExamsFromDb() {
        let groupInfo = await this.getAndStoreGroupInfo();
        if (!groupInfo) return undefined;

        let result = await ExamModel.find({ group: this.name, semester: groupInfo.sem, year: groupInfo.year }).lean().exec();
        if (!result) return undefined;

        return result as IExam[];
    }

    getExamsFromCache(ignoreTTL = false) {
        if (!this.cache.examsTTL || (this.cache.examsTTL < new Date() && !ignoreTTL)) return undefined;

        return this.cache.exams;
    }

    async sendExamsToDb(newExams: IExam[]) {
        if (!newExams.length) return;

        let year = newExams[0].year;
        let semester = newExams[0].semester;

        // TODO: Для большей надежности в будущем это стоит обернуть в транзакцию
        try {
            await ExamModel.deleteMany({ group: this.name, year, semester }).exec();
            await ExamModel.insertMany(newExams);
        } catch (error) {
            console.error(`Failed to update exams for group ${this.name}:`, error);
        }
    }

    sendExamsToCache(data: IExam[], ttl?: Date) {
        this.cache.exams = data;
        this.cache.examsTTL = ttl ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 7); // На неделю
    }

    async getRawTeachersList(): Promise<string[]> {
        let schedule = await this.getAndStoreFullTimetable();
        if (!schedule) return [];

        let teachers = new Set<string>();
        schedule.forEach((lesson) => {
            if (lesson.teacherName) teachers.add(lesson.teacherName);
        });

        return Array.from(teachers);
    }

    async getRawTeachersAndDisciplines() {
        let schedule = await this.getAndStoreFullTimetable();
        let lessons: { [key: string]: { [key: string]: string[] } } = {};

        if (schedule) {
            schedule.forEach((lesson) => {
                if (!lessons[lesson.name]) lessons[lesson.name] = {};

                let teacherName = lesson.teacherName ?? 'Не назначен';

                if (!lessons[lesson.name][teacherName]) lessons[lesson.name][teacherName] = [];
                if (!lessons[lesson.name][teacherName].includes(LessonTypes[lesson.type]))
                    lessons[lesson.name][teacherName].push(LessonTypes[lesson.type]);
            });
        }

        return lessons;
    }

    static async isZFOGroup(name: string): Promise<boolean> {
        const group = await GroupModel.findOne({ name }).lean().exec();

        if (group?.FoE) return group.FoE !== FoE.ofo;

        // Фоллбэк на основе регулярного выражения, если в БД нет информации
        return /^[^\\-]+-(АЗ|З|ОЗ)[^-]*-/.test(name);
    }

    abstract isZFOGroup(): boolean;

    // async getToken(): Promise<string> {
    //     let groupInfo = await GroupModel.findOne({ name: this.name, inst_id: this.instId }).exec();
    //
    //     if(groupInfo && groupInfo.token) return groupInfo.token;
    //     else {
    //         let token = genToken(this.name, this.instId);
    //
    //         new GroupModel({
    //             group: this.name,
    //             inst_id: this.instId,
    //             token,
    //         })
    //         .save()
    //         .catch(console.log);
    //
    //         return token;
    //     }
    // }
}
