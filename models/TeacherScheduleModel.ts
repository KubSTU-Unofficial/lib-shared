import mongoose from 'mongoose';
import { ITeacherSchedule } from '../structures/Teacher';

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        updateDate: Date,
        days: [
            {
                daynum: Number,
                even: Boolean,
                daySchedule: [
                    {
                        group: String,
                        number: Number,
                        time: String,
                        name: String,
                        paraType: String,
                        auditory: String,
                        remark: String,
                        percent: String,
                        period: [Number, Number],
                        flow: Boolean,
                    },
                ],
            },
        ],
    },
    { collection: 'teacherSchedules', versionKey: false },
);

export default mongoose.model<ITeacherSchedule>('teacherSchedules', schema);
