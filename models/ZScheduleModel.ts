import mongoose from 'mongoose';

const schema = new mongoose.Schema(
    {
        group: {
            type: String,
            required: true,
        },
        inst_id: {
            type: Number,
            required: true,
        },
        updateDate: {
            type: Date,
            required: true,
            default: new Date(),
        },
        data: [
            {
                datez: String,
                pair: Number,
                kindofnagr: {
                    kindofnagr_id: Number,
                    kindofnagr_name: String,
                },
                disc: {
                    disc_id: Number,
                    disc_name: String,
                },
                classroom: String,
                teacher: String,
                comment: String,
            },
        ],
    },
    { collection: 'zSchedules', versionKey: false },
);

export default mongoose.model('zSchedules', schema);
