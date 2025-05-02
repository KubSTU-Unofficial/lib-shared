import mongoose from 'mongoose';

const schema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            unique: true,
        },
        inst_id: {
            type: Number,
            required: true,
        },
        lessonsStartDate: {
            type: Date,
            default: undefined,
        },
        token: {
            type: String,
            default: undefined,
        },
    },
    { collection: 'groups', versionKey: false },
);

schema.index({ group: 1 });

export default mongoose.model('groups', schema);
