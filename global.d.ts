declare global {
    // Для правильной работы Date, с изменённым прототипом
    interface Date {
        getWeek(): number;
    }
}

export { };
