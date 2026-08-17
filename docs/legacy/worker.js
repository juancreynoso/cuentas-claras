// Cloudflare Worker — backend para Cuentas Claras
// Este archivo va en: worker/index.js

const ALLOWED_ORIGIN = "*"; // Cambiá por tu dominio de CF Pages cuando lo tengas
// Ej: "https://cuentas-claras.pages.dev"

export default {
  async fetch(request, env) {
    // CORS headers
    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, PUT, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
    };

    // Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers });
    }

    const url = new URL(request.url);

    // GET /gastos — devuelve todos los gastos
    if (request.method === "GET" && url.pathname === "/gastos") {
      const data = await env.GASTOS_KV.get("gastos");
      return new Response(data || "[]", { headers });
    }

    // PUT /gastos — guarda todos los gastos (reemplaza el array completo)
    if (request.method === "PUT" && url.pathname === "/gastos") {
      const body = await request.text();
      // Validación básica: tiene que ser JSON válido
      try {
        JSON.parse(body);
      } catch {
        return new Response(JSON.stringify({ error: "JSON inválido" }), {
          status: 400,
          headers,
        });
      }
      await env.GASTOS_KV.put("gastos", body);
      return new Response(JSON.stringify({ ok: true }), { headers });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers,
    });
  },
};
