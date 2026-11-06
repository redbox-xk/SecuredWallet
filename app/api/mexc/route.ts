import { createHmac } from "node:crypto"
import { NextRequest, NextResponse } from "next/server"

const MEXC_BASE_URL = "https://api.mexc.com"
const SYMBOL_PATTERN = /^[A-Z0-9]{5,20}$/

function credentials() {
  const accessKey = process.env.MEXC_ACCESS_KEY
  const secretKey = process.env.MEXC_SECRET_KEY
  if (!accessKey || !secretKey) throw new Error("MEXC credentials are not configured")
  return { accessKey, secretKey }
}

function signedQuery(params: Record<string, string>, secretKey: string) {
  const query = new URLSearchParams(params).toString()
  const signature = createHmac("sha256", secretKey).update(query).digest("hex")
  return `${query}&signature=${signature}`
}

async function mexcRequest(path: string, params: Record<string, string>, method: "GET" | "POST" = "GET") {
  const { accessKey, secretKey } = credentials()
  const signed = signedQuery({ ...params, recvWindow: "5000", timestamp: Date.now().toString() }, secretKey)
  const response = await fetch(`${MEXC_BASE_URL}${path}?${signed}`, {
    method,
    headers: { "X-MEXC-APIKEY": accessKey, "Content-Type": "application/json" },
    cache: "no-store",
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.msg || "MEXC request failed")
  return body
}

function jsonError(error: unknown, status = 500) {
  return NextResponse.json({ error: error instanceof Error ? error.message : "MEXC request failed" }, { status })
}

export async function GET(request: NextRequest) {
  try {
    const symbol = (request.nextUrl.searchParams.get("symbol") || "BTCUSDT").toUpperCase()
    if (!SYMBOL_PATTERN.test(symbol)) return jsonError(new Error("Invalid trading symbol"), 400)
    const [account, ticker, orders] = await Promise.all([
      mexcRequest("/api/v3/account", {}),
      mexcRequest("/api/v3/ticker/24hr", { symbol }),
      mexcRequest("/api/v3/openOrders", { symbol }),
    ])
    return NextResponse.json({ account, ticker, orders })
  } catch (error) {
    return jsonError(error, error instanceof Error && error.message.includes("credentials") ? 503 : 502)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const symbol = String(body.symbol || "").toUpperCase()
    const side = String(body.side || "").toUpperCase()
    const type = String(body.type || "").toUpperCase()
    const quantity = Number(body.quantity)
    const price = body.price === undefined || body.price === "" ? undefined : Number(body.price)

    if (!SYMBOL_PATTERN.test(symbol) || !["BUY", "SELL"].includes(side) || !["MARKET", "LIMIT"].includes(type)) {
      return jsonError(new Error("Invalid order parameters"), 400)
    }
    if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000_000) {
      return jsonError(new Error("Quantity must be positive and within the allowed limit"), 400)
    }
    if (type === "LIMIT" && (typeof price !== "number" || !Number.isFinite(price) || price <= 0)) {
      return jsonError(new Error("A positive limit price is required"), 400)
    }

    const params: Record<string, string> = { symbol, side, type, quantity: String(quantity) }
    if (price !== undefined) params.price = String(price)
    if (type === "LIMIT") params.timeInForce = "GTC"
    const order = await mexcRequest("/api/v3/order", params, "POST")
    return NextResponse.json({ order })
  } catch (error) {
    return jsonError(error, error instanceof Error && error.message.includes("credentials") ? 503 : 502)
  }
}
