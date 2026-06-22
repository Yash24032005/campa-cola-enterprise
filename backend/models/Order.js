const mongoose = require('mongoose');

const OrderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            quantity: { type: Number, required: true },
            price: { type: Number, required: true }
        }
    ],
    totalAmount: { type: Number, required: true },
    shippingAddress: {
        addressLine: { type: String, required: true },
        city: { type: String, required: true },
        pincode: { type: String, required: true }
    },
    paymentStatus: { type: String, default: 'Pending' }, // Pending, Paid, Failed
    razorpayOrderId: { type: String, required: true },
    razorpayPaymentId: { type: String, default: '' },
    date: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', OrderSchema);