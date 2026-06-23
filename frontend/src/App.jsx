import React, { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import './App.css';

export default function App() {
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState([]);
  const [loading, setLoading] = useState(true);
  const [preloader, setPreloader] = useState(true);
  
  // Auth & Admin States
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [authMode, setAuthMode] = useState('none'); 
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [adminView, setAdminView] = useState(false);
  const [adminLogs, setAdminLogs] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image: '', category: 'flagship', badge: '' });

  // 🛠️ Dynamic Product Edit Mode States
  const [isEditing, setIsEditing] = useState(false);
  const [editProductId, setEditProductId] = useState(null);

  // Shipping Address Panel States
  const [addressMode, setAddressMode] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({ addressLine: '', city: '', pincode: '' });

  // 📝 Customer Enquiry State
  const [enquiryForm, setEnquiryForm] = useState({ name: '', email: '', message: '' });

  // Animation Refs
  const heroTextRef = useRef(null);
  const heroSubRef = useRef(null);
  const canRef = useRef(null);

  // Fetch Live Inventory Data
  useEffect(() => {
    fetch('http://localhost:5000/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
        setTimeout(() => setPreloader(false), 2200); 
      })
      .catch(err => console.error("Database connection lost: ", err));
  }, []);

  // GSAP Entrance Core Trigger
  useEffect(() => {
    if (!preloader && !loading) {
      const tl = gsap.timeline();
      tl.fromTo(heroTextRef.current, { y: 100, opacity: 0 }, { y: 0, opacity: 1, duration: 1, ease: 'power4.out' })
        .fromTo(heroSubRef.current, { y: 50, opacity: 0 }, { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out' }, "-=0.5")
        .fromTo(canRef.current, { scale: 0.2, rotation: -180, opacity: 0 }, { scale: 1, rotation: 0, opacity: 1, duration: 1.5, ease: 'elastic.out(1, 0.75)' }, "-=0.6");
    }
  }, [preloader, loading]);

  // Auth Operations
  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'login' ? 'login' : 'register';
    try {
      const res = await fetch(`http://localhost:5000/api/auth/${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(authForm)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem('token', data.token);
        setToken(data.token);
        setUser(data.user);
        setAuthMode('none');
        alert(`Welcome back, ${data.user.name}!`);
      } else {
        alert(data.msg || "Authentication Failed");
      }
    } catch (err) { alert("Server connectivity issues"); }
  };

  // Cart Logic
  const addToCart = (product) => {
    const existing = cart.find(item => item.product === product._id);
    if (existing) {
      setCart(cart.map(item => item.product === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product: product._id, name: product.name, price: product.price, quantity: 1 }]);
    }
    alert(`${product.name} added to cart structure!`);
  };

  const initiateCheckoutFlow = () => {
    if (!token) { setAuthMode('login'); return; }
    if (cart.length === 0) { alert("Cart is empty!"); return; }
    setAddressMode(true); 
  };

  // Core Razorpay SDK Engine
  const executeRazorpayPayment = async (e) => {
    e.preventDefault();
    setAddressMode(false); 
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      const resOrder = await fetch('http://localhost:5000/api/orders/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ amount: totalAmount })
      });
      const orderData = await resOrder.json();

      if (!orderData.id) {
        alert("Could not create Razorpay order.");
        return;
      }

      const options = {
        key: "rzp_test_T4d01Z0WWvOm9s",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Campa Cola Enterprise",
        description: "Secure Digital Payment Core Engine",
        order_id: orderData.id,
        handler: async function (response) {
          const completeCheck = await fetch('http://localhost:5000/api/orders/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({
              items: cart, totalAmount, shippingAddress,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id
            })
          });
          const serverStatus = await completeCheck.json();
          if (serverStatus.success) {
            alert(`🎉 Razorpay Payment Verified!\nTransaction ID: ${response.razorpay_payment_id}`);
            setCart([]);
          }
        },
        theme: { color: "#ff003c" }
      };

      const rzpWindow = new window.Razorpay(options);
      rzpWindow.open();
    } catch (err) { alert("Payment checkout script crashed."); }
  };

  // 📝 FIXED ENQUIRY SUBMITTER
  const handleEnquirySubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:5000/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(enquiryForm)
      });
      const data = await res.json();
      if (data.success) {
        alert("💥 Enquiry Logged! Your details are stored in the Admin DB Dashboard.");
        setEnquiryForm({ name: '', email: '', message: '' }); 
      } else {
        alert("Submission failed: " + (data.error || "Unknown response statement"));
      }
    } catch (err) {
      console.error("Enquiry submission error: ", err);
      alert("Network Error: Make sure backend is active on port 5000!");
    }
  };

  // Admin Dashboard Loading Panel
  const loadAdminDashboard = async () => {
    if (!token) return;
    const res = await fetch('http://localhost:5000/api/admin/contacts', { headers: { 'x-auth-token': token } });
    const data = await res.json();
    setAdminLogs(data);
    setAdminView(true);
  };

  // 🛠️ COMBINED HANDLER: CREATE OR UPDATE PRODUCT
  const handleProductFormSubmit = async (e) => {
    e.preventDefault();
    const url = isEditing 
      ? `http://localhost:5000/api/admin/products/${editProductId}`
      : 'http://localhost:5000/api/admin/products';
    const method = isEditing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify(newProduct)
      });
      const data = await res.json();

      if (data.success) {
        if (isEditing) {
          alert("🔄 Product Matrix Updated in live database!");
          setProducts(products.map(p => p._id === editProductId ? data.product : p));
          setIsEditing(false);
          setEditProductId(null);
        } else {
          alert("🚀 Product published to live clusters!");
          setProducts([...products, data.product]);
        }
        setNewProduct({ name: '', description: '', price: '', image: '', category: 'flagship', badge: '' });
      } else {
        alert("Operation execution failed.");
      }
    } catch (err) { alert("Server connectivity error."); }
  };

  // Trigger Edit Mode state variables
  const startEditProductFlow = (product) => {
    setIsEditing(true);
    setEditProductId(product._id);
    setNewProduct({
      name: product.name,
      description: product.description,
      price: product.price,
      image: product.image,
      category: product.category || 'flagship',
      badge: product.badge || ''
    });
  };

  return (
    <div>
      {/* Cinematic Preloader */}
      {preloader && (
        <div className="preloader-gate">
          <div className="preloader-text-wrap">
            <h1 className="pulse-text">GREAT INDIAN FIZZ</h1>
            <div className="progress-bar-wrap"><div className="progress-line"></div></div>
          </div>
        </div>
      )}

      {/* Navigation Layer */}
      <nav>
        <div className="navbar">
          <div className="logo"><a href="#" onClick={() => setAdminView(false)}>CAMPA PRO</a></div>
          <ul className="menu">
            <li><a href="#flagship" onClick={() => setAdminView(false)}>Flavors</a></li>
            <li><a href="#enquiry-section" onClick={() => setAdminView(false)}>Submit Enquiry</a></li>
            {user?.role === 'admin' && <li><a href="#" onClick={loadAdminDashboard} style={{ color: '#00e5ff' }}>Admin Console</a></li>}
            <li><button className="buy-btn" style={{ border: 'none', background: '#ff003c' }} onClick={initiateCheckoutFlow}>🛒 Cart ({cart.reduce((a, b) => a + b.quantity, 0)})</button></li>
            <li>{user ? <button className="buy-btn" onClick={() => { setUser(null); setToken(''); localStorage.clear(); setAdminView(false); }}>Logout ({user.name})</button> : <button className="buy-btn" onClick={() => setAuthMode('login')}>Login / Register</button>}</li>
          </ul>
        </div>
      </nav>

      {/* Authentication Overlay */}
      {authMode !== 'none' && (
        <div className="modal-overlay">
          <div className="contact-form" style={{ position: 'relative' }}>
            <button className="close-modal" onClick={() => setAuthMode('none')}>✕</button>
            <h2>{authMode.toUpperCase()}</h2>
            <form onSubmit={handleAuthSubmit}>
              {authMode === 'signup' && <input type="text" placeholder="Full Name" onChange={e => setAuthForm({ ...authForm, name: e.target.value })} required />}
              <input type="email" placeholder="Email" onChange={e => setAuthForm({ ...authForm, email: e.target.value })} required />
              <input type="password" placeholder="Password" onChange={e => setAuthForm({ ...authForm, password: e.target.value })} required />
              {authMode === 'signup' && (
                <select style={{ width: '100%', padding: '1rem', background: '#000', color: '#fff', marginBottom: '1.5rem', borderRadius: '10px' }} onChange={e => setAuthForm({ ...authForm, role: e.target.value })}>
                  <option value="user">Standard Customer</option>
                  <option value="admin">System Administrator</option>
                </select>
              )}
              <button type="submit" className="submit-btn">{authMode === 'login' ? 'Secure Login' : 'Create Account'}</button>
            </form>
            <p style={{ marginTop: 15, textAlign: 'center', cursor: 'pointer', color: '#9ca3af' }} onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}>
              {authMode === 'login' ? "New here? Build Identity" : "Existing pipeline? Sign In"}
            </p>
          </div>
        </div>
      )}

      {/* Shipping Address Overlay */}
      {addressMode && (
        <div className="modal-overlay">
          <div className="contact-form" style={{ position: 'relative' }}>
            <button className="close-modal" onClick={() => setAddressMode(false)}>✕</button>
            <h2 style={{ marginBottom: '20px' }}>Shipping Destination</h2>
            <form onSubmit={executeRazorpayPayment}>
              <input type="text" placeholder="Flat / House No. / Street Address Line" onChange={e => setShippingAddress({ ...shippingAddress, addressLine: e.target.value })} required />
              <input type="text" placeholder="City" onChange={e => setShippingAddress({ ...shippingAddress, city: e.target.value })} required />
              <input type="text" placeholder="Pincode (6 digits)" maxLength="6" onChange={e => setShippingAddress({ ...shippingAddress, pincode: e.target.value })} required />
              <button type="submit" className="submit-btn" style={{ background: '#4caf50' }}>Proceed to Secure Payment</button>
            </form>
          </div>
        </div>
      )}

      {/* Main View rendering control logic */}
      {!adminView ? (
        <>
          <header className="hero-viewport">
            <div className="hero-layout">
              <div className="hero-text-side">
                <h1 ref={heroTextRef}>The Taste <br /><span>Of Magic.</span></h1>
                <p ref={heroSubRef}>Reinventing the bold Indian legacy with maximum carbonation, secure MERN structures, and cinematic interface modules.</p>
              </div>
              <div className="hero-visual-side">
                <img ref={canRef} src="https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600" alt="Premium Campa Can" className="cinematic-can" />
              </div>
            </div>
          </header>

          <section id="flagship">
            <h2>Live Production Engine Inventory</h2>
            {loading ? <p style={{ textAlign: 'center' }}>Syncing Server Matrix...</p> : (
              <div className="product-grid">
                {products.map((product) => (
                  <div className="premium-card" key={product._id}>
                    {product.badge && <span className="card-badge">{product.badge}</span>}
                    <img src={product.image} alt={product.name} />
                    <h3>{product.name}</h3>
                    <p>{product.description}</p>
                    <div className="price-tag">₹{product.price}</div>
                    <button className="buy-btn" onClick={() => addToCart(product)}>Add To Cart</button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Enquiry Submission Framework */}
          <section id="enquiry-section">
            <h2>Connect With HQ / Submit Enquiry</h2>
            <div className="contact-form">
              <form onSubmit={handleEnquirySubmit}>
                <input type="text" placeholder="Your Name" value={enquiryForm.name} onChange={e => setEnquiryForm({ ...enquiryForm, name: e.target.value })} required />
                <input type="email" placeholder="Your Email Address" value={enquiryForm.email} onChange={e => setEnquiryForm({ ...enquiryForm, email: e.target.value })} required />
                <textarea placeholder="Write your business or customer enquiry details here..." rows="5" value={enquiryForm.message} onChange={e => setEnquiryForm({ ...enquiryForm, message: e.target.value })} required></textarea>
                <button type="submit" className="submit-btn">Send Secure Enquiry</button>
              </form>
            </div>
          </section>
        </>
      ) : (
        /* ================= 👔 SYSTEM ADMIN VIEW PANEL COMPONENT ================= */
        <section style={{ marginTop: '80px' }}>
          <h2 style={{ color: '#00e5ff' }}>👔 HQ System Control Console ({isEditing ? "EDIT MODE ACTIVE" : "CREATE MODE"})</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', textAlign: 'left' }}>
            
            {/* Dynamic Form Controller */}
            <div className="contact-form" style={{ flex: 1, minWidth: '300px' }}>
              <h3>{isEditing ? "Modify Existing Product Matrix" : "Launch New Product Line"}</h3><br />
              <form onSubmit={handleProductFormSubmit}>
                <input type="text" placeholder="Product Name" value={newProduct.name} onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
                <input type="text" placeholder="Description" value={newProduct.description} onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} required />
                <input type="number" placeholder="Price (INR)" value={newProduct.price} onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required />
                <input type="text" placeholder="Unsplash Image Link" value={newProduct.image} onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} required />
                <input type="text" placeholder="Badge" value={newProduct.badge} onChange={e => setNewProduct({ ...newProduct, badge: e.target.value })} />
                <button type="submit" className="submit-btn" style={{ background: isEditing ? '#ffaa00' : '#00e5ff', color: '#000' }}>
                  {isEditing ? "Apply DB Update Changes" : "Publish to Live DB"}
                </button>
                {isEditing && (
                  <button type="button" className="buy-btn" style={{ marginTop: '10px' }} onClick={() => { setIsEditing(false); setNewProduct({ name: '', description: '', price: '', image: '', category: 'flagship', badge: '' }); }}>
                    Cancel Edit Mode
                  </button>
                )}
              </form>
            </div>

            {/* LIVE PRODUCTS CATALOG INVENTORY MANAGER TABLE */}
            <div style={{ flex: 1, minWidth: '300px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3 style={{ color: '#ffaa00' }}>📦 Live Inventory Catalog Manager</h3><br />
              <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                {products.map(prod => (
                  <div key={prod._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                    <div>
                      <strong>{prod.name}</strong>
                      <p style={{ fontSize: '12px', color: '#9ca3af' }}>Price: ₹{prod.price}</p>
                    </div>
                    <button className="buy-btn" style={{ width: 'auto', padding: '5px 15px', borderColor: '#ffaa00', color: '#ffaa00' }} onClick={() => startEditProductFlow(prod)}>
                      ✏️ Edit Matrix
                    </button>
                  </div>
                ))}
              </div>
              <br/><hr style={{ borderColor: 'rgba(255,255,255,0.1)' }}/><br/>
              <h3>Incoming Customer Inquiries ({adminLogs.length})</h3><br />
              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {adminLogs.map(log => (
                  <div key={log._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
                    <strong>👤 {log.name}</strong> <small style={{ color: '#9ca3af' }}>({log.email})</small>
                    <p style={{ color: '#d1d5db', marginTop: '5px' }}>💬 {log.message}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        </section>
      )}

      <footer>
        <p>&copy; 2026 Campa Cola Enterprise Hub. All rights reserved.</p>
      </footer>
    </div>
  );
}