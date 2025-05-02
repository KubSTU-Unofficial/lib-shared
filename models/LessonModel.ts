import mongoose, {SchemaDefinitionType} from 'mongoose';

export interface ILesson {
    day: {
        nedType: boolean,
        dayOfWeek: number,
        weeks: {
            from: number,
            to: number,
            startDate?: Date;
        },
    } | { datez: string };
    number: number;
    name: string;
    type: number;
    classroom?: string;
    teacherName?: string;
    percentOfGroup?: number;
    isStream?: boolean;
    isDistant?: boolean;
    comment?: string;
}

export interface ILessonSchema extends ILesson {
    group: string;
}

const schema = new mongoose.Schema<ILessonSchema, {}, {}, {}, SchemaDefinitionType<ILessonSchema>>(
    {
        group: {type: String, required: true},
        day: {
            nedType: Boolean,
            dayOfWeek: Number,
            datez: String,
            weeks: {
                from: Number,
                to: Number,
                startDate: Date,
            },
        },
        number: {type: Number, required: true},
        name: {type: String, required: true},
        type: {type: Number, required: true},
        classroom: String,
        teacherName: String,
        percentOfGroup: {
            type: Number,
            default: 100,
        },
        isStream: Boolean,
        isDistant: {type: Boolean, default: false},
        comment: String,
    },
    {collection: 'lessons', versionKey: false},
);

schema.index({ group: 1 });
schema.index({ teacherName: 1 });

export default mongoose.model('lessons', schema);
