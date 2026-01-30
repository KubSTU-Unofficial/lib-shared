import { startOfWeek, differenceInWeeks } from 'date-fns';

// Нужно для самих кнопок и чтобы они нажимались
export const daysOdd = ['Нечёт Пн', 'Нечёт Вт', 'Нечёт Ср', 'Нечёт Чт', 'Нечёт Пт', 'Нечёт Сб'];
export const daysEven = ['Чёт Пн', 'Чёт Вт', 'Чёт Ср', 'Чёт Чт', 'Чёт Пт', 'Чёт Сб'];

export const days = ['ВОСКРЕСЕНЬЕ', 'ПОНЕДЕЛЬНИК', 'ВТОРНИК', 'СРЕДА', 'ЧЕТВЕРГ', 'ПЯТНИЦА', 'СУББОТА'];

export const faculties = {
    'ФНГиЭ': 495,
    'ФИТиК': 516,
    'ФБиПП': 490,
    'ФЭУиБ': 29,
    'ФАСиАД': 538,
    'ФИМиТ': 539,
    'ФФН': 540,
    'ИТК': 541,
    'ПОдИО': 34,
    'НПИ': 50,
    'АМТИ': 52,
} as const;

export const facultiesReverse = Object.freeze(
    Object.fromEntries(
        Object.entries(faculties).map(([name, id]) => [id, name])
    )
) as Record<number, keyof typeof faculties>;

/**
* Возвращает понедельник заданной недели. Если день заданной недели это воскресенье, то вернёт следующий понедельник.
*/
export function getMonday(oldDate: Date) {
    let date = new Date(oldDate);
    date.setDate(date.getDate() - (date.getDay() == 7 ? 0 : date.getDay()) + 1);
    return date;
}

/*
* Вернёт номер недели от стартовой
*/
export function weekNumber(startDate: Date, date: Date = new Date()): number {
    const start = startOfWeek(startDate, { weekStartsOn: 1 });
    const end = startOfWeek(date, { weekStartsOn: 1 });
    return differenceInWeeks(end, start) + 1;
}

/**
* Генерирует 32-символьный токен
*/
// export function genToken(name: string, inst_id: number) {
//     let chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'.split('');
//     let token = '';
//     for (let i = 0; i < 32; i++) {
//         let j = Math.floor(Math.random() * (chars.length - 1));
//         token += chars[j];
//     }
//     return `${name}:${inst_id}:${token}`;
// }

/**
 * Возвращает текущий учебный год и семестр.
 */
export function getCurrentSemesterInfo() {
    const now = new Date();
    const year = now.getFullYear() - (now.getMonth() >= 6 ? 0 : 1);
    const semester = now.getMonth() > 5 ? 1 : 2;
    return { year, semester };
}
