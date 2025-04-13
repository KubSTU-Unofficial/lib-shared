import { IRespBasePara } from '../lib/APIConvertor';

export default abstract class BaseGroup<T extends IRespBasePara> {
    kurs: number;
    cachedFullRawSchedule?: {
        data: T[];
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
    static lessonsTypes: { [key: string]: string } = {
        Лекции: 'Лекция',
        'Практические занятия': 'Практика',
        'Лабораторные занятия': 'Лабораторная',
    };

    constructor(
        public name: string,
        public instId: number,
    ) {
        let year = +(name[0] + name[1]);
        let now = new Date();

        this.kurs = now.getUTCFullYear() - 2000 - (now.getUTCMonth() >= 6 ? 0 : 1) - year + 1; // FIXME: Будет работать до 2100 года
    }

    /**
     * Берёт расписание с сайта
     * Если сайт не работает, берёт его с БД
     * Если в БД расписания нет, возвращает undefined
     */
    abstract getFullRawSchedule(): Promise<T[] | undefined>;

    abstract getDayRawSchedule(date: Date): Promise<T[] | undefined>;
    abstract getDayRawSchedule(day: number, week: boolean): Promise<T[] | undefined>;

    abstract getDayRawSchedule(day: Date | number, week?: boolean): Promise<T[] | undefined>;

    async getRawTeachersList(): Promise<string[]> {
        let schedule = await this.getFullRawSchedule();
        let teachers: string[] = [];

        if (schedule) {
            schedule.forEach((lesson) => {
                if (lesson.teacher !== 'Не назначен' && !teachers.includes(lesson.teacher!)) teachers.push(lesson.teacher!);
            });
        }

        return teachers;
    }

    async getRawTeachersAndDisciplines() {
        let schedule = await this.getFullRawSchedule();
        let lessons: { [key: string]: { [key: string]: string[] } } = {};

        if (schedule) {
            schedule.forEach((lesson) => {
                if (!lessons[lesson.disc.disc_name]) lessons[lesson.disc.disc_name] = {};
                if (!lessons[lesson.disc.disc_name][lesson.teacher]) lessons[lesson.disc.disc_name][lesson.teacher] = [];
                if (!lessons[lesson.disc.disc_name][lesson.teacher].includes(lesson.kindofnagr.kindofnagr_name))
                    lessons[lesson.disc.disc_name][lesson.teacher].push(lesson.kindofnagr.kindofnagr_name);
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

    abstract getToken(): Promise<string>;
}
