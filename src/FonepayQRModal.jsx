import { useEffect, useRef, useState } from "react";

const BACKEND_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const QR_EXPIRY_SECONDS = 5 * 60;

export function FonepayQRModal({ qrMessage, websocketUrl, prn, amount, onSuccess, onClose }) {
  const [secondsLeft, setSecondsLeft] = useState(QR_EXPIRY_SECONDS);
  const [qrScanned, setQrScanned] = useState(false);
  const [checking, setChecking] = useState(false);
  const successHandled = useRef(false);
  const wsRef = useRef(null);
  const pollRef = useRef(null);
  const timerRef = useRef(null);

  const cleanup = () => {
    wsRef.current?.close();
    if (pollRef.current) clearInterval(pollRef.current);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  const handleSuccess = () => {
    if (successHandled.current) return;
    successHandled.current = true;
    cleanup();
    onSuccess();
  };

  const checkPayment = async (manual = false) => {
    if (manual) setChecking(true);
    try {
      const res = await fetch(`${BACKEND_URL}/functions/v1/verify-fonepay-payment`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({ prn }),
      });
      const data = await res.json();

      const isSuccess =
        data?.isSuccess === true ||
        data?.paymentSuccess ||
        data?.transactionStatus?.paymentSuccess ||
        data?.status === "SUCCESS" ||
        data?.statusCode === "S00";

      const isScanned = data?.statusCode === "S01" || data?.qrVerified;
      if (isScanned) setQrScanned(true);
      if (isSuccess) handleSuccess();
    } finally {
      if (manual) setChecking(false);
    }
  };

  useEffect(() => {
    // Countdown timer
    timerRef.current = setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          cleanup();
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    // WebSocket — primary real-time detection
    try {
      const ws = new WebSocket(websocketUrl);
      wsRef.current = ws;
      ws.onmessage = (event) => {
        try {
          const raw = JSON.parse(event.data);
          // Fonepay may double-serialize transactionStatus
          const txStatus =
            typeof raw.transactionStatus === "string"
              ? JSON.parse(raw.transactionStatus)
              : raw.transactionStatus;
          if (txStatus?.paymentSuccess) handleSuccess();
          else if (txStatus?.qrVerified) setQrScanned(true);
        } catch (_) {}
      };
    } catch (_) {}

    // Polling fallback — critical for mobile users who switch apps
    pollRef.current = setInterval(() => checkPayment(), 3000);

    return cleanup;
  }, []);

  const expired = secondsLeft === 0;
  const mins = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const secs = String(secondsLeft % 60).padStart(2, "0");

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <button className="modal-close" onClick={onClose}>✕</button>

        <h2>Pay with Fonepay</h2>
        <p className="modal-amount">Rs {amount.toLocaleString()}</p>

        {!expired ? (
          <>
            <div className="qr-wrapper">
              <img
                src={`https://api.blanxer.com/public/qr?q=${encodeURIComponent(qrMessage)}`}
                alt="Scan with your banking app"
                width={220}
                height={220}
              />
            </div>

            <p className="instructions">
              Open your banking app and scan the QR code
            </p>

            {qrScanned && (
              <p className="scanned-notice">QR scanned — waiting for confirmation...</p>
            )}

            <div className="timer">
              Expires in <span className={secondsLeft < 60 ? "timer-urgent" : ""}>{mins}:{secs}</span>
            </div>

            <button
              className="check-btn"
              onClick={() => checkPayment(true)}
              disabled={checking}
            >
              {checking ? "Checking..." : "Check Payment"}
            </button>
          </>
        ) : (
          <div className="expired">
            <p>QR code expired.</p>
            <button className="check-btn" onClick={onClose}>Generate New QR</button>
          </div>
        )}
      </div>
    </div>
  );
}
