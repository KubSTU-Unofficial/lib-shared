import mongoose from "mongoose";

// Сделано для определения чётности недели
// Returns the ISO week of the date.
// Source: https://weeknumber.net/how-to/javascript
Date.prototype.getWeek = function () {
    let date = new Date(this.getTime());
    date.setHours(0, 0, 0, 0);
    date.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
    let week1 = new Date(date.getFullYear(), 0, 4);
    return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
};

export default async function bootstrap() {
    try {
        mongoose.set('strictQuery', true);
        await mongoose.connect(process.env.MONGO_URI ?? 'mongodb://localhost:27017/kubstu');

        if (!process.env.KUBSTU_API) {
            console.error('Отсутствует переменная окружения KUBSTU_API. Выход.')
            process.exit(0);
        }
    } catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        process.exit(1);
    }
}
