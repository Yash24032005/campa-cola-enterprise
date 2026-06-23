const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Razorpay = require('razorpay');
const connectDB = require('./config/db');
const auth = require('./middleware/auth');
const Contact = require('./models/Contact');
const Product = require('./models/Product');
const User = require('./models/User');
const Order = require('./models/Order');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
connectDB();

// Razorpay Instance Initialization
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_T4d01Z0WWvOm9s',
    key_secret: process.env.RAZORPAY_KEY_SECRET || 'O3xJ5Wr38jvK6Z4QifvwbN7F'
});

// ================= AUTHENTICATION APIS =================
app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password, role } = req.body;
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ msg: 'User already exists' });
        user = new User({ name, email, password, role: role || 'user' });
        const salt = await bcrypt.genSalt(10); user.password = await bcrypt.hash(password, salt); await user.save();
        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, 'campasecrettoken123', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err; res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
        });
    } catch (err) { res.status(500).send('Server Error'); }
});

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        let user = await User.findOne({ email });
        if (!user) return res.status(400).json({ msg: 'Invalid Credentials' });
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid Credentials' });
        const payload = { user: { id: user.id, role: user.role } };
        jwt.sign(payload, 'campasecrettoken123', { expiresIn: 360000 }, (err, token) => {
            if (err) throw err; res.json({ token, user: { name: user.name, email: user.email, role: user.role } });
        });
    } catch (err) { res.status(500).send('Server Error'); }
});

app.get('/api/products', async (req, res) => {
    try { const products = await Product.find({}); res.json(products); } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

// ================= 📝 LIVE CUSTOMER ENQUIRY ROUTE =================
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, message } = req.body;
        if (!name || !email || !message) {
            return res.status(400).json({ success: false, error: "All fields are required" });
        }
        const newContact = new Contact({ name, email, message });
        await newContact.save();
        res.status(201).json({ success: true, message: "Enquiry logged successfully!" });
    } catch (err) {
        res.status(500).json({ success: false, error: "Database saving failed: " + err.message });
    }
});

// ================= RAZORPAY ORDERS ENDPOINT =================
app.post('/api/orders/razorpay', auth, async (req, res) => {
    try {
        const { amount } = req.body;
        
        const options = {
            amount: amount * 100, // Amount in paisa
            currency: "INR",
            receipt: "rcpt_" + Math.random().toString(36).substr(2, 9)
        };

        const response = await razorpay.orders.create(options);
        res.json({
            id: response.id,
            currency: response.currency,
            amount: response.amount
        });
    } catch (err) {
        res.status(500).json({ error: "Razorpay order generation failed: " + err.message });
    }
});

// ================= SAVE ORDER & VERIFY =================
app.post('/api/orders/checkout', auth, async (req, res) => {
    try {
        const { items, totalAmount, shippingAddress, razorpayOrderId, razorpayPaymentId } = req.body;
        
        const newOrder = new Order({
            user: req.user.id,
            items,
            totalAmount,
            shippingAddress,
            paymentStatus: 'Paid',
            razorpayOrderId,
            razorpayPaymentId
        });

        await newOrder.save();
        res.status(201).json({ success: true, order: newOrder });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// ================= ADMIN PANELS =================
app.post('/api/admin/products', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Admins only' });
    try { const newProduct = new Product(req.body); await newProduct.save(); res.status(201).json({ success: true, product: newProduct }); } catch (err) { res.status(500).send('Server Error'); }
});

// 🌟 DYNAMIC PRODUCT EDIT ROUTE (PUT ENGINE ADDED)
app.put('/api/admin/products/:id', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ success: false, msg: 'Access Denied: Admins only' });
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
        if (!updatedProduct) return res.status(404).json({ success: false, msg: 'Product not found in system matrix' });
        res.json({ success: true, product: updatedProduct });
    } catch (err) { 
        res.status(500).send('Server Error during product update: ' + err.message); 
    }
});

app.get('/api/admin/contacts', auth, async (req, res) => {
    if (req.user.role !== 'admin') return res.status(403).json({ msg: 'Access Denied' });
    try { const logs = await Contact.find().sort({ date: -1 }); res.json(logs); } catch (err) { res.status(500).send('Server Error'); }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🔥 Enterprise Razorpay Server running on port ${PORT}`));