import mongoose, { SchemaDefinitionType } from 'mongoose';
import { FoE } from '../lib/APIConvertor.js';

// TODO: 
interface newIGroup {
    name: string;
    fakId: number;
    FoE: FoE;
    isActive: boolean;
    timing?: {
        lessonsPeriod?: Date[];
        sem: number;
        year: number;
    }
    token?: string;
}

export interface IGroupSchema {
    name: string;
    fakId: number;
    FoE: FoE;
    lessonsStartDate?: Date;
    lessonsEndDate?: Date;
    sem: number;
    year: number;
    token?: string;
}

const schema = new mongoose.Schema<IGroupSchema, {}, {}, {}, SchemaDefinitionType<IGroupSchema>>(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        fakId: {
            type: Number,
            required: true,
        },
        FoE: { // Форма обучения
            type: Number,
            enum: Object.values(FoE).filter(v => typeof v === 'number'),
            default: FoE.ofo,
        },
        lessonsStartDate: {
            type: Date,
            required: false,
        },
        lessonsEndDate: {
            type: Date,
            required: false,
        },
        sem: {
            type: Number,
            default: 1,
        },
        year: { // Это не курс! Это расписание за какой учебный год показывать этой группе
            type: Number,
            default: new Date().getFullYear(),
        },
        token: {
            type: String,
        }
    },
    { collection: 'groups', versionKey: false },
);

export default mongoose.model('groups', schema);
