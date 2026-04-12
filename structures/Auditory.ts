import LessonModel from "../models/LessonModel.js";

function arrayDifference<T>(arr1: T[], arr2: T[]): T[] {
    const set2 = new Set(arr2);
    return arr1.filter(item => !set2.has(item));
}

export default class Classroom {
    // Сохранённые ответы о занятых аудиториях
    static cachedAnswers: Map<string, { data: ({ _id: number, classrooms: string[] })[], createdAt: Date }> = new Map();

    /*
     * Возвращает список занятых аудиторий в корпусе
     * */
    static async getOccupiedClassrooms(building: string) {
        let now = new Date();
        let now0 = new Date(now.setHours(0, 0, 0, 0))
        let startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        let cachedOccupiedClassrooms = this.cachedAnswers.get(building);

        if (cachedOccupiedClassrooms
            && now.valueOf() - cachedOccupiedClassrooms.createdAt.valueOf() < 1000 * 60 * 60 * 4
            && cachedOccupiedClassrooms.createdAt >= startOfToday
        ) return cachedOccupiedClassrooms.data;

        let occupiedClassrooms: ({ _id: number, classrooms: string[] })[] = await LessonModel.aggregate([
            {
                $match: {
                    $or: [
                        {
                            'timing.weeks.isEven': now.getWeek() % 2 == 0,
                            'timing.weeks.dayOfWeek': now.getDay(),
                            'timing.weeks.startDate': { $lte: now },
                            'timing.weeks.endDate': { $gte: now },
                        },
                        {
                            'timing.date': now0
                        }
                    ],
                    classroom: { $regex: `^${building}-` },
                },
            },
            {
                $group: {
                    _id: '$timing.lessonNumber', // группируем по номеру пары
                    classrooms: { $addToSet: '$classroom' }, // уникальные аудитории
                },
            },
            {
                $sort: { _id: 1 }, // сортируем по номеру пары
            },
        ]);

        this.cachedAnswers.set(building, {
            data: occupiedClassrooms,
            createdAt: now,
        });

        return occupiedClassrooms;
    }

    /*
     * Возвращает список всех аудиторий в определённом корпусе
     * */
    static async getAllClassrooms(building: string) {
        return await LessonModel.distinct('classroom', { classroom: { $regex: `^${building}-` } });
    }

    /*
     * Возвращает список свободных аудиторий в корпусе в определённую пару
     * */
    static async getFreeClassrooms(building: string, number: number) {
        let occupiedClassrooms = (await Classroom.getOccupiedClassrooms(building)).find(g => g._id == number)?.classrooms ?? [];
        let allClassrooms = await this.getAllClassrooms(building)

        return arrayDifference(allClassrooms, occupiedClassrooms);
    }
}
