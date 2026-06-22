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
  const [authMode, setAuthMode] = useState('none'); // 'login', 'signup', 'none'
  const [authForm, setAuthForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [adminView, setAdminView] = useState(false);
  const [adminLogs, setAdminLogs] = useState([]);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: '', image: '', category: 'flagship', badge: '' });

  // Shipping Address Panel States
  const [addressMode, setAddressMode] = useState(false);
  const [shippingAddress, setShippingAddress] = useState({ addressLine: '', city: '', pincode: '' });

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
        loading && setLoading(false);
        setTimeout(() => setPreloader(false), 2200); // Smooth entrance timing
      })
      .catch(err => console.error("Database connection lost: ", err));
  }, [loading]);

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

  // Cart Logic Entry Point
  const addToCart = (product) => {
    const existing = cart.find(item => item.product === product._id);
    if (existing) {
      setCart(cart.map(item => item.product === product._id ? { ...item, quantity: item.quantity + 1 } : item));
    } else {
      setCart([...cart, { product: product._id, name: product.name, price: product.price, quantity: 1 }]);
    }
    alert(`${product.name} added to cart structure!`);
  };

  // Checkout Initiation (Opens Address Portal First)
  const initiateCheckoutFlow = () => {
    if (!token) { setAuthMode('login'); return; }
    if (cart.length === 0) { alert("Cart is empty!"); return; }
    setAddressMode(true); // Open address input modal
  };

  // Core Razorpay SDK Execution Engine
  const executeRazorpayPayment = async (e) => {
    e.preventDefault();
    setAddressMode(false); // Close the address overlay modal
    
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    try {
      // 1. Backend route par hit karke Razorpay order generate karna
      const resOrder = await fetch('http://localhost:5000/api/orders/razorpay', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
        body: JSON.stringify({ amount: totalAmount })
      });
      const orderData = await resOrder.json();

      if (!orderData.id) {
        alert("Could not create Razorpay order. Check backend configurations.");
        return;
      }

      // 2. Open standard Razorpay custom checkout pop-up overlay frame
      const options = {
        // key: "rzp_test_YourKeyHere", // Aap isko real key id se replace kar sakte ho
        key: "rzp_test_T4d01Z0WWvOm9s",
        amount: orderData.amount,
        currency: orderData.currency,
        name: "Campa Cola Enterprise",
        description: "Secure Digital Payment Core Engine",
        order_id: orderData.id,
        handler: async function (response) {
          // 3. Payment success hone par address metadata aur txn log data ko MongoDB me push karna
          const completeCheck = await fetch('http://localhost:5000/api/orders/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
            body: JSON.stringify({
              items: cart,
              totalAmount,
              shippingAddress,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id
            })
          });
          const serverStatus = await completeCheck.json();
          if (serverStatus.success) {
            alert(`🎉 Razorpay Payment Verified!\nTransaction ID: ${response.razorpay_payment_id}\nOrder compiled and securely saved in database.`);
            setCart([]);
          }
        },
        theme: { color: "#ff003c" }
      };

      const rzpWindow = new window.Razorpay(options);
      rzpWindow.open();

    } catch (err) { alert("Payment checkout script crashed."); }
  };

  // Admin Dashboard Loading Panel
  const loadAdminDashboard = async () => {
    if (!token) return;
    const res = await fetch('http://localhost:5000/api/admin/contacts', { headers: { 'x-auth-token': token } });
    const data = await res.json();
    setAdminLogs(data);
    setAdminView(true);
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    const res = await fetch('http://localhost:5000/api/admin/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-auth-token': token },
      body: JSON.stringify(newProduct)
    });
    const data = await res.json();
    if (data.success) {
      alert("Product published to live clusters!");
      setProducts([...products, data.product]);
    }
  };

  return (
    <div>
      {/* Cinematic Entry Preloader Layer */}
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
            {user?.role === 'admin' && <li><a href="#" onClick={loadAdminDashboard} style={{ color: '#00e5ff' }}>Admin Console</a></li>}
            <li><button className="buy-btn" style={{ border: 'none', background: '#ff003c' }} onClick={initiateCheckoutFlow}>🛒 Cart ({cart.reduce((a, b) => a + b.quantity, 0)})</button></li>
            <li>{user ? <button className="buy-btn" onClick={() => { setUser(null); setToken(''); localStorage.clear(); setAdminView(false); }}>Logout ({user.name})</button> : <button className="buy-btn" onClick={() => setAuthMode('login')}>Login / Register</button>}</li>
          </ul>
        </div>
      </nav>

      {/* Authentication Gateway Frame */}
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

      {/* 📦 SHIPPING ADDRESS OVERLAY MODAL */}
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

      {/* Dynamic Render Controller */}
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
        </>
      ) : (
        /* SYSTEM ADMIN COMPONENT LAYER */
        <section style={{ marginTop: '80px' }}>
          <h2 style={{ color: '#00e5ff' }}>👔 HQ System Control Console</h2>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '30px', textAlign: 'left' }}>
            <div className="contact-form" style={{ flex: 1, minWidth: '300px' }}>
              <h3>Launch New Product Line</h3><br />
              <form onSubmit={handleAddProduct}>
                <input type="text" placeholder="Product Name" onChange={e => setNewProduct({ ...newProduct, name: e.target.value })} required />
                <input type="text" placeholder="Description" onChange={e => setNewProduct({ ...newProduct, description: e.target.value })} required />
                <input type="number" placeholder="Price (INR)" onChange={e => setNewProduct({ ...newProduct, price: e.target.value })} required />
                <input type="text" placeholder="Unsplash Image Link" onChange={e => setNewProduct({ ...newProduct, image: e.target.value })} required />
                <input type="text" placeholder="Badge" onChange={e => setNewProduct({ ...newProduct, badge: e.target.value })} />
                <button type="submit" className="submit-btn" style={{ background: '#00e5ff', color: '#000' }}>Publish to Live DB</button>
              </form>
            </div>
            <div style={{ flex: 1, minWidth: '300px', background: 'rgba(255,255,255,0.02)', padding: '20px', borderRadius: '15px', border: '1px solid rgba(255,255,255,0.1)' }}>
              <h3>Incoming Customer Inquiries ({adminLogs.length})</h3><br />
              {adminLogs.map(log => (
                <div key={log._id} style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '10px', marginBottom: '10px' }}>
                  <strong>👤 {log.name}</strong> <small style={{ color: '#9ca3af' }}>({log.email})</small>
                  <p style={{ color: '#d1d5db', marginTop: '5px' }}>💬 {log.message}</p>
                </div>
              ))}
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