import { useState } from "react";
import { FonepayQRModal } from "./FonepayQRModal";
import "./App.css";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const PRODUCT = {
  name: "Test Product",
  price: 10,
  description: "A sample product to test Fonepay Dynamic QR payment.",
};

export default function App() {
  const [qrData, setQrData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [paid, setPaid] = useState(false);

  const handleBuy = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/generate-fonepay-qr`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          amount: PRODUCT.price,
          remarks1: `Purchase; ${PRODUCT.name}`,
          remarks2: "TestCustomer",
        }),
      });

      const data = await res.json();

      if (!data?.qrMessage) {
        throw new Error(data?.error || "Failed to generate QR code");
      }

      setQrData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSuccess = () => {
    setQrData(null);
    setPaid(true);
  };

  return (
    <div className="page">
      <h1 className="store-title">Fonepay Demo Store</h1>

      {paid ? (
        <div className="success-banner">
          <span className="success-icon">✓</span>
          <div>
            <strong>Payment successful!</strong>
            <p>Thank you for your purchase of {PRODUCT.name}.</p>
          </div>
          <button className="reset-btn" onClick={() => setPaid(false)}>
            Buy Again
          </button>
        </div>
      ) : (
        <div className="product-card">
          <div className="product-icon">📦</div>
          <h2>{PRODUCT.name}</h2>
          <p className="product-desc">{PRODUCT.description}</p>
          <p className="product-price">Rs {PRODUCT.price}</p>

          {error && <p className="error-msg">{error}</p>}

          <button className="buy-btn" onClick={handleBuy} disabled={loading}>
            {loading ? "Generating QR..." : "Pay with Fonepay"}
          </button>
        </div>
      )}

      {qrData && (
        <FonepayQRModal
          qrMessage={qrData.qrMessage}
          websocketUrl={qrData.thirdpartyQrWebSocketUrl}
          prn={qrData.prn}
          amount={PRODUCT.price}
          onSuccess={handleSuccess}
          onClose={() => setQrData(null)}
        />
      )}
    </div>
  );
}
