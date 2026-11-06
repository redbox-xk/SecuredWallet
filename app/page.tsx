"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"
import Image from "next/image"
import { ethers } from "ethers"
import { QRCodeSVG } from "qrcode.react"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Copy,
  Send,
  Download,
  ArrowUpRight,
  ArrowDownLeft,
  RefreshCw,
  Eye,
  EyeOff,
  Shield,
  Wallet,
  Settings,
  LogOut,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Fuel,
  Globe,
  KeyRound,
  Lock,
  Search,
  TrendingUp,
  TrendingDown,
  Coins,
  ShieldCheck,
  Fingerprint,
} from "lucide-react"

// ---------------------------------------------------------------------------
// Network Configuration - MAINNET ONLY (no testnets)
// ---------------------------------------------------------------------------
const NETWORKS: Record<
  string,
  { name: string; rpc: string; chainId: number; symbol: string; explorer: string; decimals: number; coingeckoId: string }
> = {
  mainnet: {
    name: "Ethereum",
    rpc: "https://eth.llamarpc.com",
    chainId: 1,
    symbol: "ETH",
    explorer: "https://etherscan.io",
    decimals: 18,
    coingeckoId: "ethereum",
  },
  polygon: {
    name: "Polygon",
    rpc: "https://polygon-rpc.com",
    chainId: 137,
    symbol: "MATIC",
    explorer: "https://polygonscan.com",
    decimals: 18,
    coingeckoId: "matic-network",
  },
  bsc: {
    name: "BNB Smart Chain",
    rpc: "https://bsc-dataseed.binance.org",
    chainId: 56,
    symbol: "BNB",
    explorer: "https://bscscan.com",
    decimals: 18,
    coingeckoId: "binancecoin",
  },
  arbitrum: {
    name: "Arbitrum One",
    rpc: "https://arb1.arbitrum.io/rpc",
    chainId: 42161,
    symbol: "ETH",
    explorer: "https://arbiscan.io",
    decimals: 18,
    coingeckoId: "ethereum",
  },
  avalanche: {
    name: "Avalanche",
    rpc: "https://api.avax.network/ext/bc/C/rpc",
    chainId: 43114,
    symbol: "AVAX",
    explorer: "https://snowtrace.io",
    decimals: 18,
    coingeckoId: "avalanche-2",
  },
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface TxRecord {
  hash: string
  to: string
  from: string
  value: string
  timestamp: number
  status: "pending" | "confirmed" | "failed"
  network: string
}

interface CoinData {
  id: string
  symbol: string
  name: string
  image: string
  current_price: number
  price_change_percentage_24h: number
  market_cap: number
  market_cap_rank: number
  total_volume: number
  sparkline_in_7d?: { price: number[] }
}

type AppView = "onboarding" | "dashboard"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function shortAddr(addr: string) {
  if (!addr) return ""
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function copyText(text: string) {
  navigator.clipboard.writeText(text)
}

function formatUsd(n: number) {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`
  if (n >= 1000) return `$${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`
  if (n >= 1) return `$${n.toFixed(2)}`
  return `$${n.toFixed(6)}`
}

// ---------------------------------------------------------------------------
// SecBadge Logo Component
// ---------------------------------------------------------------------------
function SecBadge({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <Image
      src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image-5D6E2D7A-WUg9vcEYXUynN6pyVtfGpBo0hTdDwR.jpeg"
      alt="CKS Crypto Klein Shop logo"
      width={size}
      height={size}
      className={`rounded-full ${className}`}
      priority
    />
  )
}

// ---------------------------------------------------------------------------
// CoinGecko fetcher
// ---------------------------------------------------------------------------
const COINGECKO_MARKETS =
  "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=120&page=1&sparkline=true&price_change_percentage=24h"

async function fetchMarkets(url: string): Promise<CoinData[]> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  })
  if (!res.ok) throw new Error("CoinGecko API error")
  return res.json()
}

// ---------------------------------------------------------------------------
// Sparkline mini chart
// ---------------------------------------------------------------------------
function Sparkline({ data, positive }: { data: number[]; positive: boolean }) {
  if (!data || data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  const w = 60
  const h = 20
  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((v - min) / range) * h
      return `${x},${y}`
    })
    .join(" ")
  return (
    <svg width={w} height={h} className="inline-block">
      <polyline
        points={points}
        fill="none"
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth="1.5"
      />
    </svg>
  )
}

// ---------------------------------------------------------------------------
// Main App
// ---------------------------------------------------------------------------
export default function CKSApp() {
  const [view, setView] = useState<AppView>("onboarding")
  const [wallet, setWallet] = useState<ethers.HDNodeWallet | null>(null)
  const [mnemonic, setMnemonic] = useState("")
  const [balance, setBalance] = useState("0")
  const [networkKey, setNetworkKey] = useState("mainnet")
  const [transactions, setTransactions] = useState<TxRecord[]>([])
  const [gasPrice, setGasPrice] = useState("0")
  const [isLoading, setIsLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState("wallet")
  const [coinSearch, setCoinSearch] = useState("")

  // Privacy
  const [settingsShowPhrase, setSettingsShowPhrase] = useState(false)
  const [settingsShowKey, setSettingsShowKey] = useState(false)

  // Send form
  const [sendTo, setSendTo] = useState("")
  const [sendAmount, setSendAmount] = useState("")
  const [sendGasLimit, setSendGasLimit] = useState("21000")
  const [sending, setSending] = useState(false)
  const [txHash, setTxHash] = useState("")

  // Dialogs
  const [showReceive, setShowReceive] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showTxResult, setShowTxResult] = useState(false)
  const [txError, setTxError] = useState("")

  // Recovery
  const [recoverPhrase, setRecoverPhrase] = useState("")
  const [recoverError, setRecoverError] = useState("")

  const network = NETWORKS[networkKey]
  const providerRef = useRef<ethers.JsonRpcProvider | null>(null)

  // Fetch coins
  const { data: coins } = useSWR<CoinData[]>(
    view === "dashboard" ? COINGECKO_MARKETS : null,
    fetchMarkets,
    { refreshInterval: 60000, revalidateOnFocus: false, dedupingInterval: 30000 }
  )

  const filteredCoins = useMemo(() => {
    if (!coins) return []
    if (!coinSearch.trim()) return coins
    const q = coinSearch.toLowerCase()
    return coins.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.symbol.toLowerCase().includes(q)
    )
  }, [coins, coinSearch])

  const balanceUsd = useMemo(() => {
    if (!coins) return null
    const match = coins.find((c) => c.id === network.coingeckoId)
    if (!match) return null
    return parseFloat(balance) * match.current_price
  }, [coins, balance, network.coingeckoId])

  const getProvider = useCallback(() => {
    if (!providerRef.current || providerRef.current._network?.chainId !== BigInt(network.chainId)) {
      providerRef.current = new ethers.JsonRpcProvider(network.rpc, network.chainId)
    }
    return providerRef.current
  }, [network.rpc, network.chainId])

  const fetchBalance = useCallback(async () => {
    if (!wallet) return
    try {
      const provider = getProvider()
      const bal = await provider.getBalance(wallet.address)
      setBalance(ethers.formatEther(bal))
    } catch {
      setBalance("--")
    }
  }, [wallet, getProvider])

  const fetchGas = useCallback(async () => {
    try {
      const provider = getProvider()
      const fee = await provider.getFeeData()
      if (fee.gasPrice) {
        setGasPrice(ethers.formatUnits(fee.gasPrice, "gwei"))
      }
    } catch {
      setGasPrice("--")
    }
  }, [getProvider])

  // Poll balance and gas
  useEffect(() => {
    if (view !== "dashboard" || !wallet) return
    fetchBalance()
    fetchGas()
    const interval = setInterval(() => {
      fetchBalance()
      fetchGas()
    }, 15000)
    return () => clearInterval(interval)
  }, [view, wallet, fetchBalance, fetchGas])

  // Network change
  useEffect(() => {
    providerRef.current = null
    if (wallet) {
      fetchBalance()
      fetchGas()
    }
  }, [networkKey, wallet, fetchBalance, fetchGas])

  // Load saved wallet
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("sec_mnemonic")
      const savedNet = sessionStorage.getItem("sec_network")
      const savedTx = sessionStorage.getItem("sec_tx")
      if (saved) {
        const w = ethers.HDNodeWallet.fromPhrase(saved)
        setWallet(w)
        setMnemonic(saved)
        setView("dashboard")
      }
      if (savedNet && NETWORKS[savedNet]) {
        setNetworkKey(savedNet)
      }
      if (savedTx) {
        setTransactions(JSON.parse(savedTx))
      }
    } catch {
      // No saved wallet
    }
  }, [])

  useEffect(() => {
    sessionStorage.setItem("sec_network", networkKey)
  }, [networkKey])

  useEffect(() => {
    if (transactions.length > 0) {
      sessionStorage.setItem("sec_tx", JSON.stringify(transactions))
    }
  }, [transactions])

  // ---------------------------------------------------------------------------
  // Wallet Actions
  // ---------------------------------------------------------------------------
  function createWallet() {
    setIsLoading(true)
    setTimeout(() => {
      const w = ethers.HDNodeWallet.createRandom()
      setWallet(w)
      setMnemonic(w.mnemonic!.phrase)
      sessionStorage.setItem("sec_mnemonic", w.mnemonic!.phrase)
      setIsLoading(false)
      setView("dashboard")
    }, 600)
  }

  function recoverWallet() {
    setRecoverError("")
    try {
      const phrase = recoverPhrase.trim().toLowerCase()
      if (!ethers.Mnemonic.isValidMnemonic(phrase)) {
        setRecoverError("Invalid mnemonic phrase. Please check and try again.")
        return
      }
      const w = ethers.HDNodeWallet.fromPhrase(phrase)
      setWallet(w)
      setMnemonic(phrase)
      sessionStorage.setItem("sec_mnemonic", phrase)
      setView("dashboard")
    } catch {
      setRecoverError("Failed to recover wallet. Check your phrase.")
    }
  }

  function lockWallet() {
    sessionStorage.removeItem("sec_mnemonic")
    sessionStorage.removeItem("sec_tx")
    setWallet(null)
    setMnemonic("")
    setBalance("0")
    setTransactions([])
    setView("onboarding")
    setSettingsShowPhrase(false)
    setSettingsShowKey(false)
    setActiveTab("wallet")
    setShowSettings(false)
  }

  async function sendTransaction() {
    if (!wallet || !sendTo || !sendAmount) return
    setSending(true)
    setTxError("")
    setTxHash("")

    try {
      const provider = getProvider()
      const signer = new ethers.Wallet(wallet.privateKey, provider)

      const tx = await signer.sendTransaction({
        to: sendTo,
        value: ethers.parseEther(sendAmount),
        gasLimit: BigInt(sendGasLimit),
      })

      setTxHash(tx.hash)

      const record: TxRecord = {
        hash: tx.hash,
        to: sendTo,
        from: wallet.address,
        value: sendAmount,
        timestamp: Date.now(),
        status: "pending",
        network: networkKey,
      }
      setTransactions((prev) => [record, ...prev])

      setShowSend(false)
      setShowTxResult(true)

      const receipt = await tx.wait()
      setTransactions((prev) =>
        prev.map((t) =>
          t.hash === tx.hash ? { ...t, status: receipt?.status === 1 ? "confirmed" : "failed" } : t
        )
      )
      fetchBalance()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Transaction failed"
      setTxError(message.length > 200 ? message.slice(0, 200) + "..." : message)
      setShowTxResult(true)
    } finally {
      setSending(false)
      setSendTo("")
      setSendAmount("")
    }
  }

  function handleCopyAddress() {
    if (!wallet) return
    copyText(wallet.address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ---------------------------------------------------------------------------
  // Onboarding Screen
  // ---------------------------------------------------------------------------
  if (view === "onboarding") {
    return (
      <main className="min-h-screen bg-background px-4 py-5 sm:px-8 sm:py-8">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
          <header className="flex items-center justify-between border-b border-border pb-4">
            <div className="flex items-center gap-3">
              <SecBadge size={42} className="rounded-xl shadow-sm" />
              <div>
                <p className="text-lg font-bold tracking-tight text-foreground">CKS</p>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Crypto Klein Shop</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 text-xs font-medium text-muted-foreground sm:flex">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Non-custodial · Selbstverwahrt
            </div>
          </header>

          <section className="grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
            <div className="space-y-6">
              <Badge className="rounded-full border-primary/20 bg-primary/10 px-3 py-1 text-primary hover:bg-primary/10">
                <ShieldCheck className="mr-1.5 h-3.5 w-3.5" />
                Self-custody / Selbstverwahrung
              </Badge>
              <div className="space-y-4">
                <h1 className="max-w-2xl text-4xl font-bold leading-[1.08] tracking-tight text-foreground sm:text-6xl">
                  Your Crypto.<br /><span className="text-primary">Your Keys.</span><br />Your Control.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
                  Die moderne Wallet für digitale Souveränität — sicher, transparent und ohne Zwischenhändler.
                  <span className="mt-2 block">A modern wallet for digital sovereignty — secure, transparent, and without intermediaries.</span>
                </p>
              </div>
              <div className="grid max-w-xl grid-cols-3 gap-3 border-y border-border py-4">
                <div><p className="text-lg font-bold text-foreground">100%</p><p className="text-[11px] leading-tight text-muted-foreground">Non-custodial<br />Selbstverwahrt</p></div>
                <div><p className="text-lg font-bold text-foreground">5+</p><p className="text-[11px] leading-tight text-muted-foreground">Mainnets<br />Netzwerke</p></div>
                <div><p className="text-lg font-bold text-foreground">0</p><p className="text-[11px] leading-tight text-muted-foreground">Middlemen<br />Zwischenhändler</p></div>
              </div>
            </div>

            <div className="glass rounded-3xl p-5 shadow-xl shadow-primary/5 sm:p-7">
              <div className="mb-5 flex items-center justify-between">
                <div><p className="text-xl font-bold text-foreground">Start securely</p><p className="text-sm text-muted-foreground">Sicher starten</p></div>
                <Lock className="h-5 w-5 text-primary" />
              </div>
              <Tabs defaultValue="create" className="w-full">
                <TabsList className="grid min-h-[48px] w-full grid-cols-2 bg-secondary/60">
                  <TabsTrigger value="create" className="min-h-[44px] gap-1 px-1 text-xs font-semibold sm:gap-2 sm:text-sm"><Shield className="h-4 w-4 shrink-0" />Erstellen / Create</TabsTrigger>
                  <TabsTrigger value="recover" className="min-h-[44px] gap-1 px-1 text-xs font-semibold sm:gap-2 sm:text-sm"><KeyRound className="h-4 w-4 shrink-0" />Wiederherstellen / Recover</TabsTrigger>
                </TabsList>
                <TabsContent value="create">
                  <div className="space-y-5 pt-5">
                    <div className="flex items-start gap-3"><div className="rounded-xl bg-primary/10 p-2 text-primary"><Wallet className="h-5 w-5" /></div><div><h2 className="font-semibold text-foreground">Neue Wallet erstellen</h2><p className="mt-1 text-sm leading-relaxed text-muted-foreground">Generate a new Ethereum wallet with a secure 12-word recovery phrase. Your keys never leave this device.</p></div></div>
                    <Button onClick={createWallet} disabled={isLoading} className="min-h-[52px] w-full rounded-xl text-base font-semibold">{isLoading ? <RefreshCw className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}{isLoading ? "Generating..." : "Wallet erstellen / Create wallet"}</Button>
                  </div>
                </TabsContent>
                <TabsContent value="recover">
                  <div className="space-y-4 pt-5"><div><h2 className="font-semibold text-foreground">Wallet wiederherstellen</h2><p className="mt-1 text-sm text-muted-foreground">Enter your 12-word phrase to restore access. / Gib deine 12 Wörter ein.</p></div><div className="space-y-2"><Label htmlFor="recover-phrase" className="text-foreground">Recovery phrase / Wiederherstellungsphrase</Label><Textarea id="recover-phrase" placeholder="word1 word2 word3 ... word12" value={recoverPhrase} onChange={(e) => setRecoverPhrase(e.target.value)} className="min-h-[96px] resize-none font-mono text-sm" /></div>{recoverError && <div className="flex items-center gap-2 text-sm text-destructive"><AlertTriangle className="h-4 w-4 shrink-0" />{recoverError}</div>}<Button onClick={recoverWallet} className="min-h-[52px] w-full rounded-xl text-base font-semibold"><Download className="h-5 w-5" />Wiederherstellen / Recover</Button></div>
                </TabsContent>
              </Tabs>
              <div className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground"><Lock className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" /><span>Keys never leave your browser. / Deine Schlüssel verlassen niemals deinen Browser.</span></div>
            </div>
          </section>

          <section className="grid gap-3 border-t border-border pt-6 sm:grid-cols-3">
            {[{ icon: ShieldCheck, title: "Sicher by design", text: "Private keys stay on your device. / Private Schlüssel bleiben auf deinem Gerät." }, { icon: Globe, title: "Multi-network", text: "Ethereum, Polygon, BNB, Arbitrum & Avalanche." }, { icon: Fingerprint, title: "Du hast die Kontrolle", text: "No accounts, no tracking, no gatekeepers. / Keine Konten, kein Tracking." }].map(({ icon: Icon, title, text }) => <div key={title} className="flex gap-3 rounded-2xl border border-border bg-card/70 p-4"><Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" /><div><p className="text-sm font-semibold text-foreground">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></div>)}
          </section>
          <footer className="text-center text-xs text-muted-foreground">© 2026 CKS Crypto Klein Shop · Made for sovereign finance / Für souveräne Finanzen</footer>
        </div>
      </main>
    )
  }

  // ---------------------------------------------------------------------------
  // Dashboard Screen
  // ---------------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-strong px-4 py-3">
        <div className="flex items-center justify-between max-w-lg mx-auto">
          <div className="flex items-center gap-2.5">
            <SecBadge size={32} />
            <span className="font-bold text-lg text-foreground tracking-tight">CKS</span>
          </div>

          <div className="flex items-center gap-2">
            <Select value={networkKey} onValueChange={setNetworkKey}>
              <SelectTrigger className="w-auto min-h-[44px] text-xs font-medium bg-secondary/50 border-border gap-1.5 px-3">
                <Globe className="w-3.5 h-3.5 text-primary" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(NETWORKS).map(([key, net]) => (
                  <SelectItem key={key} value={key}>
                    {net.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSettings(true)}
              className="min-h-[44px] min-w-[44px]"
            >
              <Settings className="w-5 h-5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-lg mx-auto px-4 pt-4 space-y-4">
        {/* Balance Card */}
        <div className="glass rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <SecBadge size={24} />
              <span className="text-sm text-muted-foreground font-medium">Total Balance</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => { fetchBalance(); fetchGas() }}
              className="min-h-[44px] min-w-[44px]"
            >
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </Button>
          </div>

          <div className="flex items-baseline gap-2 mb-1">
            <span className="text-3xl font-bold text-foreground font-mono">
              {parseFloat(balance).toFixed(6)}
            </span>
            <span className="text-sm text-muted-foreground font-medium">{network.symbol}</span>
          </div>

          {balanceUsd !== null && (
            <p className="text-sm text-primary font-medium">
              {formatUsd(balanceUsd)} USD
            </p>
          )}

          <Separator className="my-4 bg-border/50" />

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Fuel className="w-3.5 h-3.5" />
              <span className="font-mono">{parseFloat(gasPrice).toFixed(1)} Gwei</span>
            </div>
            <button
              onClick={handleCopyAddress}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[44px] px-2"
            >
              {copied ? (
                <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              <span className="font-mono">{wallet ? shortAddr(wallet.address) : ""}</span>
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            onClick={() => setShowSend(true)}
            className="min-h-[52px] rounded-xl text-sm font-semibold"
            size="lg"
          >
            <Send className="w-4 h-4" />
            Send
          </Button>
          <Button
            onClick={() => setShowReceive(true)}
            variant="outline"
            className="min-h-[52px] rounded-xl text-sm font-semibold border-border text-foreground"
            size="lg"
          >
            <Download className="w-4 h-4" />
            Receive
          </Button>
        </div>

        {/* Tabs: Wallet / Markets / Activity */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-secondary/50 min-h-[48px]">
            <TabsTrigger value="wallet" className="min-h-[44px] gap-1.5 text-xs font-semibold">
              <SecBadge size={16} />
              Wallet
            </TabsTrigger>
            <TabsTrigger value="markets" className="min-h-[44px] gap-1.5 text-xs font-semibold">
              <SecBadge size={16} />
              Markets
            </TabsTrigger>
            <TabsTrigger value="activity" className="min-h-[44px] gap-1.5 text-xs font-semibold">
              <SecBadge size={16} />
              Activity
            </TabsTrigger>
          </TabsList>

          {/* ---- Wallet Tab ---- */}
          <TabsContent value="wallet" className="mt-4 space-y-4">
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Image src="https://hebbkx1anhila5yf.public.blob.vercel-storage.com/Image-5D6E2D7A-WUg9vcEYXUynN6pyVtfGpBo0hTdDwR.jpeg" alt="" width={28} height={28} className="rounded-full" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{network.symbol}</p>
                  <p className="text-xs text-muted-foreground">{network.name}</p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-sm font-bold font-mono text-foreground">
                    {parseFloat(balance).toFixed(6)}
                  </p>
                  {balanceUsd !== null && (
                    <p className="text-xs text-muted-foreground">{formatUsd(balanceUsd)}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Security status */}
            <div className="glass rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                  <ShieldCheck className="w-5 h-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">Wallet Secured</p>
                  <p className="text-xs text-muted-foreground">Your keys are guarded locally</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Lock className="w-3.5 h-3.5 text-primary" />
                  <span>Client-side keys</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Fingerprint className="w-3.5 h-3.5 text-primary" />
                  <span>Session encrypted</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Shield className="w-3.5 h-3.5 text-primary" />
                  <span>No server storage</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  <span>Keys in Settings</span>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* ---- Markets Tab ---- */}
          <TabsContent value="markets" className="mt-4 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search tokens..."
                value={coinSearch}
                onChange={(e) => setCoinSearch(e.target.value)}
                className="pl-9 min-h-[44px]"
              />
            </div>

            {!coins ? (
              <div className="glass rounded-2xl p-8 text-center">
                <RefreshCw className="w-6 h-6 text-muted-foreground animate-spin mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Loading live prices...</p>
              </div>
            ) : filteredCoins.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Search className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">No tokens found</p>
              </div>
            ) : (
              <div className="space-y-1">
                {filteredCoins.map((coin) => {
                  const positive = coin.price_change_percentage_24h >= 0
                  return (
                    <div
                      key={coin.id}
                      className="glass rounded-xl px-3 py-3 flex items-center gap-3"
                    >
                      <span className="text-xs text-muted-foreground w-5 text-right font-mono">
                        {coin.market_cap_rank}
                      </span>
                      <Image
                        src={coin.image}
                        alt={coin.name}
                        width={28}
                        height={28}
                        className="rounded-full"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{coin.name}</p>
                        <p className="text-xs text-muted-foreground uppercase">{coin.symbol}</p>
                      </div>
                      {coin.sparkline_in_7d?.price && (
                        <Sparkline data={coin.sparkline_in_7d.price} positive={positive} />
                      )}
                      <div className="text-right">
                        <p className="text-sm font-bold font-mono text-foreground">
                          {formatUsd(coin.current_price)}
                        </p>
                        <p className={`text-xs font-mono flex items-center gap-0.5 justify-end ${positive ? "text-green-400" : "text-red-400"}`}>
                          {positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                          {Math.abs(coin.price_change_percentage_24h).toFixed(2)}%
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>

          {/* ---- Activity Tab ---- */}
          <TabsContent value="activity" className="mt-4">
            {transactions.length === 0 ? (
              <div className="glass rounded-2xl p-8 text-center">
                <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm font-semibold text-foreground">No transactions yet</p>
                <p className="text-xs text-muted-foreground mt-1">Send or receive to see activity here</p>
              </div>
            ) : (
              <div className="space-y-2">
                {transactions.map((tx) => (
                  <TxCard key={tx.hash} tx={tx} myAddress={wallet?.address || ""} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 glass-strong px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        <div className="max-w-lg mx-auto flex items-center justify-around">
          <NavButton
            icon={<Wallet className="w-5 h-5" />}
            label="Wallet"
            active={activeTab === "wallet"}
            onClick={() => setActiveTab("wallet")}
          />
          <NavButton
            icon={<Send className="w-5 h-5" />}
            label="Send"
            onClick={() => setShowSend(true)}
          />
          <button
            onClick={() => setShowReceive(true)}
            className="flex flex-col items-center justify-center -mt-4 min-h-[44px] min-w-[44px]"
          >
            <div className="w-12 h-12 rounded-full bg-primary flex items-center justify-center ring-4 ring-background">
              <SecBadge size={32} />
            </div>
            <span className="text-[10px] text-muted-foreground mt-1">Receive</span>
          </button>
          <NavButton
            icon={<Coins className="w-5 h-5" />}
            label="Markets"
            active={activeTab === "markets"}
            onClick={() => setActiveTab("markets")}
          />
          <NavButton
            icon={<Settings className="w-5 h-5" />}
            label="Settings"
            onClick={() => setShowSettings(true)}
          />
        </div>
      </nav>

      {/* ===== SEND DIALOG ===== */}
      <Dialog open={showSend} onOpenChange={setShowSend}>
        <DialogContent className="glass-strong border-border max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <SecBadge size={24} />
              <DialogTitle className="text-foreground">Send {network.symbol}</DialogTitle>
            </div>
            <DialogDescription>
              Transfer {network.symbol} on {network.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-foreground">Recipient Address</Label>
              <Input
                placeholder="0x..."
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
            </div>
            <div>
              <Label className="text-foreground">Amount ({network.symbol})</Label>
              <Input
                type="number"
                placeholder="0.0"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <button
                onClick={() => setSendAmount(balance)}
                className="mt-1 text-xs text-primary hover:underline min-h-[44px] px-1"
              >
                Max: {parseFloat(balance).toFixed(6)} {network.symbol}
              </button>
            </div>
            <div>
              <Label className="text-foreground">Gas Limit</Label>
              <Input
                value={sendGasLimit}
                onChange={(e) => setSendGasLimit(e.target.value)}
                className="mt-1.5 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Current gas: {parseFloat(gasPrice).toFixed(1)} Gwei
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowSend(false)} className="min-h-[44px]">
              Cancel
            </Button>
            <Button onClick={sendTransaction} disabled={sending || !sendTo || !sendAmount} className="min-h-[44px]">
              {sending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Sending..." : "Confirm Send"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ===== RECEIVE DIALOG ===== */}
      <Dialog open={showReceive} onOpenChange={setShowReceive}>
        <DialogContent className="glass-strong border-border max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <SecBadge size={24} />
              <DialogTitle className="text-foreground">Receive {network.symbol}</DialogTitle>
            </div>
            <DialogDescription>Share your address or scan the QR code</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <div className="bg-white p-4 rounded-xl">
              <QRCodeSVG value={wallet?.address || ""} size={180} />
            </div>
            <p className="text-xs font-mono text-muted-foreground text-center break-all px-4">
              {wallet?.address}
            </p>
            <Button onClick={handleCopyAddress} variant="outline" className="min-h-[44px]">
              {copied ? (
                <CheckCircle2 className="w-4 h-4 text-green-400" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ===== TX RESULT DIALOG ===== */}
      <Dialog open={showTxResult} onOpenChange={setShowTxResult}>
        <DialogContent className="glass-strong border-border max-w-md mx-auto rounded-2xl">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <SecBadge size={24} />
              <DialogTitle className="text-foreground">
                {txError ? "Transaction Failed" : "Transaction Sent"}
              </DialogTitle>
            </div>
          </DialogHeader>
          {txError ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="w-7 h-7 text-destructive" />
              </div>
              <p className="text-sm text-muted-foreground text-center">{txError}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">
              <div className="w-14 h-14 rounded-full bg-green-500/10 flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-green-400" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Your transaction has been broadcast.
              </p>
              {txHash && (
                <a
                  href={`${network.explorer}/tx/${txHash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  View on Explorer
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          )}
          <Button onClick={() => setShowTxResult(false)} className="w-full min-h-[44px]">
            Done
          </Button>
        </DialogContent>
      </Dialog>

      {/* ===== SETTINGS DIALOG ===== */}
      <Dialog
        open={showSettings}
        onOpenChange={(open) => {
          setShowSettings(open)
          if (!open) {
            setSettingsShowPhrase(false)
            setSettingsShowKey(false)
          }
        }}
      >
        <DialogContent className="glass-strong border-border max-w-md mx-auto rounded-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <SecBadge size={24} />
              <DialogTitle className="text-foreground">Settings & Security</DialogTitle>
            </div>
            <DialogDescription>Manage your wallet, keys, and privacy</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* Security banner */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/10">
              <SecBadge size={36} />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Your secrets are guarded. Only reveal them in a safe environment.
              </p>
            </div>

            <Separator className="bg-border/50" />

            {/* Recovery Phrase */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Recovery Phrase</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsShowPhrase(!settingsShowPhrase)}
                  className="min-h-[44px]"
                >
                  {settingsShowPhrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {!settingsShowPhrase ? (
                <div className="glass rounded-xl p-4 text-center">
                  <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Tap the eye icon to reveal your 12-word phrase
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">
                      Never share your phrase. Anyone with it can access your funds.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    {mnemonic.split(" ").map((word, i) => (
                      <div key={i} className="glass rounded-lg px-2 py-2 text-center">
                        <span className="text-[10px] text-muted-foreground">{i + 1}</span>{" "}
                        <span className="text-xs font-mono text-foreground">{word}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(mnemonic)}
                    className="w-full min-h-[44px]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Phrase
                  </Button>
                </div>
              )}
            </div>

            {/* Private Key */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Fingerprint className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">Private Key</span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSettingsShowKey(!settingsShowKey)}
                  className="min-h-[44px]"
                >
                  {settingsShowKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
              {!settingsShowKey ? (
                <div className="glass rounded-xl p-4 text-center">
                  <Lock className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
                  <p className="text-xs text-muted-foreground">
                    Tap the eye icon to reveal your private key
                  </p>
                </div>
              ) : wallet && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-destructive/5 border border-destructive/10">
                    <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                    <p className="text-xs text-destructive">
                      Never share your private key. It gives full access to your wallet.
                    </p>
                  </div>
                  <p className="font-mono text-xs text-foreground break-all glass rounded-xl p-3">
                    {wallet.privateKey}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => copyText(wallet.privateKey)}
                    className="w-full min-h-[44px]"
                  >
                    <Copy className="w-4 h-4" />
                    Copy Key
                  </Button>
                </div>
              )}
            </div>

            {/* Network */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Network</span>
              </div>
              <Select value={networkKey} onValueChange={setNetworkKey}>
                <SelectTrigger className="min-h-[44px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(NETWORKS).map(([key, net]) => (
                    <SelectItem key={key} value={key}>
                      {net.name} ({net.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Privacy Info */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Privacy</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>Keys stored in session memory only, cleared on lock</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>No server communication for key material</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>Recovery phrase hidden by default everywhere</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0" />
                  <span>All RPC calls are read-only except signed transactions</span>
                </div>
              </div>
            </div>

            <Separator className="bg-border/50" />

            <Button
              variant="destructive"
              onClick={lockWallet}
              className="w-full min-h-[52px] font-semibold rounded-xl"
            >
              <LogOut className="w-4 h-4" />
              Lock & Clear Wallet
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------
function TxCard({ tx, myAddress }: { tx: TxRecord; myAddress: string }) {
  const isSend = tx.from.toLowerCase() === myAddress.toLowerCase()
  const net = NETWORKS[tx.network] || NETWORKS.mainnet

  return (
    <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
      <div className={`w-9 h-9 rounded-full flex items-center justify-center ${isSend ? "bg-red-500/10" : "bg-green-500/10"}`}>
        {isSend ? (
          <ArrowUpRight className="w-4 h-4 text-red-400" />
        ) : (
          <ArrowDownLeft className="w-4 h-4 text-green-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-semibold text-foreground">
            {isSend ? "Sent" : "Received"}
          </p>
          <Badge
            variant={
              tx.status === "confirmed"
                ? "default"
                : tx.status === "pending"
                ? "secondary"
                : "destructive"
            }
            className="text-[10px] px-1.5 py-0"
          >
            {tx.status}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground truncate">
          {isSend ? `To: ${shortAddr(tx.to)}` : `From: ${shortAddr(tx.from)}`}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-sm font-bold font-mono ${isSend ? "text-red-400" : "text-green-400"}`}>
          {isSend ? "-" : "+"}
          {tx.value}
        </p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(tx.timestamp).toLocaleDateString()}
        </p>
      </div>
    </div>
  )
}

function NavButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center min-h-[44px] min-w-[44px] px-2 transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      {icon}
      <span className="text-[10px] mt-0.5">{label}</span>
    </button>
  )
}
