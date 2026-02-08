import mongoose, { SchemaDefinitionType } from 'mongoose';
import { LessonTypes } from '../lib/APIConvertor.js';

export interface ILessonSchema {
    group: string;          // Название группы
    name: string;           // Название дисциплины
    type: number;           // Лекция / Практика / ...
    teacherName?: string;   // Имя преподавателя
    classroom?: string;     // Аудитория

    // --- Расписание ---
    timing: {
        year: number;           // Учебный год (например, 2025)
        semester: 1 | 2;        // Семестр (1 = осень, 2 = весна)
        lessonNumber: number;   // 1–8 (номер пары)

        // --- Очное обучение ---
        weeks?: {
            from: number;       // С какой недели
            to: number;         // По какую
            startDate: Date;   // С какой даты
            endDate: Date;     // По какую

            type: boolean;      // Тип недели
            dayOfWeek: number;  // День недели
        };

        // --- Заочное обучение ---
        date?: Date;    // Дата занятия
    };

    // --- Метаданные ---
    percentOfGroup?: number;    // Процент группы
    isStream?: boolean;     // Поток
    isDistant?: boolean;    // Дистанционка
    comment?: string;       // Заметка
}


export const lessonSchema = new mongoose.Schema<ILessonSchema, {}, {}, {}, SchemaDefinitionType<ILessonSchema>>(
    {
        group: { type: String, required: true },
        name: { type: String, required: true },
        type: {
            type: Number,
            enum: Object.values(LessonTypes).filter(v => typeof v === 'number'),
            required: true
        },
        teacherName: { type: String, required: false },
        classroom: { type: String, required: false },

        timing: {
            year: { type: Number, required: true },
            semester: {
                type: Number,
                enum: [1, 2],
                required: true
            },
            lessonNumber: { type: Number, required: true },

            weeks: {
                from: Number,
                to: Number,
                startDate: Date,
                endDate: Date,

                type: { type: Boolean },
                dayOfWeek: Number,
            },

            date: Date,
        },

        percentOfGroup: Number,
        isStream: Boolean,
        isDistant: Boolean,
        comment: String,
    },
    {
        collection: 'lessons',
        versionKey: false,
    },
);

lessonSchema.index({ group: 1 });
lessonSchema.index({ teacherName: 1 });
lessonSchema.index({ classroom: 1 });
lessonSchema.index({ teacherName: "text" });

export default mongoose.model('lessons', lessonSchema);
