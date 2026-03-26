import "@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { amount, remarks1, remarks2 } = await req.json();

    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: "Invalid amount" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const merchantCode = Deno.env.get("FONEPAY_MERCHANT_CODE")!;
    const merchantSecret = Deno.env.get("FONEPAY_MERCHANT_SECRET")!;
    const username = Deno.env.get("FONEPAY_USERNAME")!;
    const password = Deno.env.get("FONEPAY_PASSWORD")!;

    // Unique transaction ID (PRN)
    const transactionId = `POS_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;

    // HMAC-SHA512: amount,prn,merchantCode,remarks1,remarks2
    const dataToHash = `${amount},${transactionId},${merchantCode},${remarks1 || ""},${remarks2 || ""}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(merchantSecret),
      { name: "HMAC", hash: "SHA-512" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(dataToHash));
    const dataValidation = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    const payload = {
      amount,
      remarks1: remarks1 || "",
      remarks2: remarks2 || "",
      prn: transactionId,
      merchantCode,
      dataValidation,
      username,
      password,
    };

    const response = await fetch(
      "https://merchantapi.fonepay.com/api/merchant/merchantDetailsForThirdParty/thirdPartyDynamicQrDownload",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    // Fix: Fonepay sometimes returns localhost in the WebSocket URL
    let wsUrl = data.thirdpartyQrWebSocketUrl || "";
    if (wsUrl && (wsUrl.includes("localhost") || wsUrl.includes("127.0.0.1"))) {
      const wsPath = wsUrl.replace(/^wss?:\/\/[^/]+/, "");
      wsUrl = `wss://ws.fonepay.com${wsPath}`;
    }

    return new Response(
      JSON.stringify({ ...data, thirdpartyQrWebSocketUrl: wsUrl, prn: transactionId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
