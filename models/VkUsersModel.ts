import mongoose from 'mongoose';

const schema = new mongoose.Schema(
    {
        userId: {
            type: String,
            required: true,
            unique: true,
        },
        inst_id: Number,
        group: String,
        notifications: {
            type: Boolean,
            default: false,
        },
        emoji: {
            type: Boolean,
            default: true,
        },
        token: {
            type: String,
            default: undefined,
        },
        showSettings: {
            type: Boolean,
            default: true,
        },
        showTeachers: {
            type: Boolean,
            default: true,
        },
        lastActivity: {
            type: Date,
            default: new Date(),
        },
    },
    { collection: 'vkUsers' },
);

export default mongoose.model('vkUsers', schema);
