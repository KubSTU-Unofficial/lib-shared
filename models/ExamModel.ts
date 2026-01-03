import mongoose, { SchemaDefinitionType } from 'mongoose';

export interface IExam {
    group: string;
    name: string;
    date: Date;
    classroom: string;
    teacher: string;
}

const schema = new mongoose.Schema<IExam, {}, {}, {}, SchemaDefinitionType<IExam>>(
    {
        group: { type: String, required: true },
        name: { type: String, required: true },
        date: { type: Date, required: true },
        classroom: { type: String, required: true },
        teacher: { type: String, required: true },
    },
    { collection: 'exams' },
);

schema.index({ group: 1 });

export default mongoose.model('exams', schema);
