"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"

const APP_KEY = "ai_infra_stock_kun_v1"

const STOCKS = [
  {
    code: "5803",
    name: "フジクラ",
    theme: "光ファイバー・AI通信インフラ",
    targetAmount: 400000,
    rounds: [150000, 130000, 120000],
  },
  {
    code: "5805",
    name: "SWCC",
    theme: "電線・電力インフラ",
    targetAmount: 240000,
    rounds: [90000, 70000, 80000],
  },
  {
    code: "6857",
    name: "アドバンテスト",
    theme: "半導体検査装置・AI半導体",
    targetAmount: 160000,
    rounds: [60000, 50000, 50000],
  },
]

const INITIAL_MARKET = {
  "5803": {
    price: 6500,
    changePct: -2.1,
    volume: 4300000,
    volumeRate: 1.6,
    per: 22.5,
    ma25: 6200,
  },
  "5805": {
    price: 8200,
    changePct: -1.4,
    volume: 680000,
    volumeRate: 1.4,
    per: 18.2,
    ma25: 7900,
  },
  "6857": {
    price: 9800,
    changePct: 3.8,
    volume: 9200000,
    volumeRate: 1.8,
    per: 35.6,
    ma25: 9300,
  },
}

const INITIAL_HOLDINGS = {
  "5803": {
    amount: "",
    shares: "",
    buyPrice: "",
    buyDate: "",
    memo: "",
  },
  "5805": {
    amount: "",
    shares: "",
    buyPrice: "",
    buyDate: "",
    memo: "",
  },
  "6857": {
    amount: "",
    shares: "",
    buyPrice: "",
    buyDate: "",
    memo: "",
  },
}

const INITIAL_DATA = {
  totalCash: 1000000,
  investPlan: 800000,
  cashKeep: 200000,
  market: INITIAL_MARKET,
  holdings: INITIAL_HOLDINGS,
  lastUpdated: "",
  manualMode: false,
  error: "",
}

function yen(value) {
  const n = Number(value || 0)
  return n.toLocaleString("ja-JP") + "円"
}

function pct(value) {
  const n = Number(value || 0)
  return n.toFixed(1) + "%"
}

function num(value) {
  return Number(value || 0)
}

function safeJsonParse(text, fallback) {
  try {
    if (!text) return fallback
    return JSON.parse(text)
  } catch (e) {
    return fallback
  }
}

function calcDeviation(price, ma25) {
  if (!price || !ma25) return 0
  return ((price - ma25) / ma25) * 100
}

function calcProfit(price, holding) {
  const shares = num(holding.shares)
  const buyPrice = num(holding.buyPrice)
  if (!shares || !buyPrice || !price) {
    return {
      value: 0,
      profit: 0,
      profitPct: 0,
      hasPosition: false,
    }
  }

  const value = price * shares
  const cost = buyPrice * shares
  const profit = value - cost
  const profitPct = cost > 0 ? (profit / cost) * 100 : 0

  return {
    value,
    profit,
    profitPct,
    hasPosition: true,
  }
}

function judgeStock(stock, market, holding) {
  const price = num(market.price)
  const changePct = num(market.changePct)
  const volumeRate = num(market.volumeRate)
  const deviation = calcDeviation(price, num(market.ma25))
  const profit = calcProfit(price, holding)

  if (profit.hasPosition) {
    if (profit.profitPct >= 35) {
      return {
        label: "大きく利確",
        tone: "danger",
        reason: "利益がかなり大きいです。欲張りすぎず、守る判断が大切です。",
        action: "多めに売って利益を確保する候補です。",
      }
    }

    if (profit.profitPct >= 25) {
      return {
        label: "半分利確",
        tone: "profit",
        reason: "十分な利益が出ています。半分売ると安心感が作れます。",
        action: "半分売って、残りで上昇を狙う作戦です。",
      }
    }

    if (profit.profitPct >= 15) {
      return {
        label: "一部利確",
        tone: "profit",
        reason: "利益が見えてきました。少し売ると心が安定します。",
        action: "一部だけ売って利益を残す候補です。",
      }
    }

    if (profit.profitPct <= -10) {
      return {
        label: "損切り検討",
        tone: "danger",
        reason: "損が大きくなっています。放置せず理由を確認する場面です。",
        action: "追加買いより、まず損切りや保有理由の見直しです。",
      }
    }

    if (profit.profitPct <= -8) {
      return {
        label: "警戒",
        tone: "warning",
        reason: "損が少し広がっています。焦って買い増ししない場面です。",
        action: "すぐ買わず、株価と出来高を確認します。",
      }
    }
  }

  if (changePct >= 10 || deviation >= 20) {
    return {
      label: "危険",
      tone: "danger",
      reason: "上がりすぎの可能性があります。高値づかみに注意です。",
      action: "今日は買い急がず、落ち着くまで待ちます。",
    }
  }

  if (changePct >= 5 || deviation >= 15) {
    return {
      label: "待ち",
      tone: "wait",
      reason: "短期で上がりすぎています。今買うと高値になりやすいです。",
      action: "押し目を待つのが安全寄りです。",
    }
  }

  if (changePct <= -3 && changePct >= -7 && volumeRate >= 1.0) {
    return {
      label: "押し目候補",
      tone: "buy",
      reason: "下げていますが、出来高がありテーマも残っています。",
      action: "1回分の一部だけ買う候補です。全力買いはしません。",
    }
  }

  if (
    changePct >= -5 &&
    changePct <= 3 &&
    volumeRate >= 1.5 &&
    deviation <= 10
  ) {
    return {
      label: "買い候補",
      tone: "buy",
      reason: "上がりすぎではなく、出来高もあります。条件は悪くありません。",
      action: "予定金額の一部だけ買う候補です。",
    }
  }

  return {
    label: "様子見",
    tone: "neutral",
    reason: "強い買い理由も、強い危険サインもまだ弱いです。",
    action: "無理に動かず、次の更新を待ちます。",
  }
}

async function fetchStockData() {
  await new Promise((resolve) => setTimeout(resolve, 600))

  const next = {}

  STOCKS.forEach((stock) => {
    const base = INITIAL_MARKET[stock.code]
    const randomMove = (Math.random() - 0.5) * 2
    const nextPrice = Math.max(1, Math.round(base.price * (1 + randomMove / 100)))

    next[stock.code] = {
      ...base,
      price: nextPrice,
      changePct: Number((base.changePct + randomMove).toFixed(1)),
      volume: Math.round(base.volume * (0.9 + Math.random() * 0.3)),
      volumeRate: Number((base.volumeRate + (Math.random() - 0.5) * 0.4).toFixed(1)),
    }
  })

  return next
}

export default function Page() {
  const [data, setData] = useState(INITIAL_DATA)
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState("home")

  useEffect(() => {
    const saved = safeJsonParse(
      typeof window !== "undefined" ? window.localStorage.getItem(APP_KEY) : "",
      INITIAL_DATA
    )

    setData({
      ...INITIAL_DATA,
      ...saved,
      market: {
        ...INITIAL_MARKET,
        ...(saved.market || {}),
      },
      holdings: {
        ...INITIAL_HOLDINGS,
        ...(saved.holdings || {}),
      },
    })
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem(APP_KEY, JSON.stringify(data))
  }, [data])

  const refreshMarket = useCallback(async () => {
    setLoading(true)

    try {
      if (data.manualMode) {
        setData((prev) => ({
          ...prev,
          lastUpdated: new Date().toLocaleString("ja-JP"),
          error: "",
        }))
        return
      }

      const market = await fetchStockData()

      setData((prev) => ({
        ...prev,
        market,
        lastUpdated: new Date().toLocaleString("ja-JP"),
        error: "",
      }))
    } catch (e) {
      setData((prev) => ({
        ...prev,
        error: "株価取得に失敗しました。前回データで表示しています。",
      }))
    } finally {
      setLoading(false)
    }
  }, [data.manualMode])

  useEffect(() => {
    refreshMarket()
    const timer = setInterval(refreshMarket, 60 * 60 * 1000)
    return () => clearInterval(timer)
  }, [refreshMarket])

  const summary = useMemo(() => {
    let invested = 0
    let currentValue = 0
    let profit = 0

    STOCKS.forEach((stock) => {
      const holding = data.holdings[stock.code]
      const market = data.market[stock.code]
      const calc = calcProfit(num(market.price), holding)

      invested += num(holding.buyPrice) * num(holding.shares)
      currentValue += calc.value
      profit += calc.profit
    })

    const remaining = Math.max(0, data.investPlan - invested)
    const profitPct = invested > 0 ? (profit / invested) * 100 : 0

    const dangerCount = STOCKS.filter((stock) => {
      const j = judgeStock(
        stock,
        data.market[stock.code],
        data.holdings[stock.code]
      )
      return j.tone === "danger"
    }).length

    const buyCount = STOCKS.filter((stock) => {
      const j = judgeStock(
        stock,
        data.market[stock.code],
        data.holdings[stock.code]
      )
      return j.tone === "buy"
    }).length

    let totalJudge = "様子見"
    let totalTone = "neutral"
    let totalText = "今日は無理に動かず、条件がそろう銘柄だけ確認します。"

    if (dangerCount >= 1) {
      totalJudge = "防御優先"
      totalTone = "danger"
      totalText = "危険サインがあります。買いよりも守りを優先します。"
    } else if (buyCount >= 1) {
      totalJudge = "一部買い候補"
      totalTone = "buy"
      totalText = "買い候補があります。ただし予定金額の一部だけです。"
    }

    return {
      invested,
      currentValue,
      profit,
      profitPct,
      remaining,
      totalJudge,
      totalTone,
      totalText,
    }
  }, [data])

  function updateHolding(code, key, value) {
    setData((prev) => ({
      ...prev,
      holdings: {
        ...prev.holdings,
        [code]: {
          ...prev.holdings[code],
          [key]: value,
        },
      },
    }))
  }

  function updateMarket(code, key, value) {
    setData((prev) => ({
      ...prev,
      market: {
        ...prev.market,
        [code]: {
          ...prev.market[code],
          [key]: value,
        },
      },
    }))
  }

  function resetAll() {
    const ok = window.confirm("保存データを初期化しますか？")
    if (!ok) return

    setData({
      ...INITIAL_DATA,
      lastUpdated: new Date().toLocaleString("ja-JP"),
    })
  }

  return (
    <main className="app">
      <section className="hero">
        <div>
          <p className="sub">AI Infrastructure Stock OS</p>
          <h1>AIインフラ株 判断くん</h1>
          <p className="lead">
            感情ではなく、ルールで短期売買を判断するためのアプリです。
          </p>
        </div>

        <button className="refresh" onClick={refreshMarket} disabled={loading}>
          {loading ? "更新中..." : "手動更新"}
        </button>
      </section>

      {data.error ? <div className="error">{data.error}</div> : null}

      <nav className="tabs">
        <button onClick={() => setActiveTab("home")} className={activeTab === "home" ? "on" : ""}>
          HOME
        </button>
        <button onClick={() => setActiveTab("stocks")} className={activeTab === "stocks" ? "on" : ""}>
          STOCK
        </button>
        <button onClick={() => setActiveTab("edit")} className={activeTab === "edit" ? "on" : ""}>
          EDIT
        </button>
        <button onClick={() => setActiveTab("help")} className={activeTab === "help" ? "on" : ""}>
          HELP
        </button>
      </nav>

      {activeTab === "home" ? (
        <section className="grid">
          <div className={"judge big " + summary.totalTone}>
            <p>今日の総合判断</p>
            <h2>{summary.totalJudge}</h2>
            <span>{summary.totalText}</span>
          </div>

          <div className="card">
            <p className="label">総資金</p>
            <h3>{yen(data.totalCash)}</h3>
          </div>

          <div className="card">
            <p className="label">投資予定額</p>
            <h3>{yen(data.investPlan)}</h3>
          </div>

          <div className="card">
            <p className="label">現金キープ</p>
            <h3>{yen(data.cashKeep)}</h3>
          </div>

          <div className="card">
            <p className="label">現在投資額</p>
            <h3>{yen(summary.invested)}</h3>
          </div>

          <div className="card">
            <p className="label">残り投資可能額</p>
            <h3>{yen(summary.remaining)}</h3>
          </div>

          <div className="card">
            <p className="label">評価額</p>
            <h3>{yen(summary.currentValue)}</h3>
          </div>

          <div className="card">
            <p className="label">損益</p>
            <h3 className={summary.profit >= 0 ? "plus" : "minus"}>
              {yen(summary.profit)}
            </h3>
            <p className={summary.profit >= 0 ? "plus" : "minus"}>
              {pct(summary.profitPct)}
            </p>
          </div>

          <div className="card full">
            <p className="label">購入予定</p>
            <div className="plan">
              <div>
                <b>第1回</b>
                <span>30万円</span>
              </div>
              <div>
                <b>第2回</b>
                <span>25万円</span>
              </div>
              <div>
                <b>第3回</b>
                <span>25万円</span>
              </div>
            </div>
          </div>

          <div className="card full">
            <p className="label">最終配分</p>
            {STOCKS.map((stock) => (
              <div className="row" key={stock.code}>
                <span>{stock.name}</span>
                <b>{yen(stock.targetAmount)}</b>
              </div>
            ))}
          </div>

          <p className="updated">
            最終更新: {data.lastUpdated || "未更新"}
          </p>
        </section>
      ) : null}

      {activeTab === "stocks" ? (
        <section className="stockList">
          {STOCKS.map((stock) => {
            const market = data.market[stock.code]
            const holding = data.holdings[stock.code]
            const deviation = calcDeviation(num(market.price), num(market.ma25))
            const profit = calcProfit(num(market.price), holding)
            const judge = judgeStock(stock, market, holding)

            return (
              <article className="stockCard" key={stock.code}>
                <div className="stockTop">
                  <div>
                    <p className="code">{stock.code}</p>
                    <h2>{stock.name}</h2>
                    <p className="theme">{stock.theme}</p>
                  </div>
                  <div className={"judge " + judge.tone}>
                    <p>判定</p>
                    <h3>{judge.label}</h3>
                  </div>
                </div>

                <div className="metrics">
                  <div>
                    <span>現在値</span>
                    <b>{yen(market.price)}</b>
                  </div>
                  <div>
                    <span>前日比</span>
                    <b className={num(market.changePct) >= 0 ? "plus" : "minus"}>
                      {pct(market.changePct)}
                    </b>
                  </div>
                  <div>
                    <span>出来高</span>
                    <b>{num(market.volume).toLocaleString("ja-JP")}</b>
                  </div>
                  <div>
                    <span>出来高倍率</span>
                    <b>{num(market.volumeRate).toFixed(1)}倍</b>
                  </div>
                  <div>
                    <span>PER</span>
                    <b>{num(market.per).toFixed(1)}倍</b>
                  </div>
                  <div>
                    <span>25日線乖離</span>
                    <b className={deviation >= 0 ? "plus" : "minus"}>
                      {pct(deviation)}
                    </b>
                  </div>
                </div>

                <div className="message">
                  <b>理由</b>
                  <p>{judge.reason}</p>
                  <b>次の行動</b>
                  <p>{judge.action}</p>
                </div>

                <div className="holdingBox">
                  <h4>保有データ</h4>
                  <div className="metrics">
                    <div>
                      <span>購入金額</span>
                      <b>{holding.amount ? yen(holding.amount) : "-"}</b>
                    </div>
                    <div>
                      <span>株数</span>
                      <b>{holding.shares || "-"}</b>
                    </div>
                    <div>
                      <span>取得単価</span>
                      <b>{holding.buyPrice ? yen(holding.buyPrice) : "-"}</b>
                    </div>
                    <div>
                      <span>評価額</span>
                      <b>{yen(profit.value)}</b>
                    </div>
                    <div>
                      <span>損益額</span>
                      <b className={profit.profit >= 0 ? "plus" : "minus"}>
                        {yen(profit.profit)}
                      </b>
                    </div>
                    <div>
                      <span>損益率</span>
                      <b className={profit.profitPct >= 0 ? "plus" : "minus"}>
                        {pct(profit.profitPct)}
                      </b>
                    </div>
                  </div>
                  {holding.memo ? <p className="memo">メモ: {holding.memo}</p> : null}
                </div>
              </article>
            )
          })}
        </section>
      ) : null}

      {activeTab === "edit" ? (
        <section className="edit">
          <div className="card full">
            <h2>基本設定</h2>

            <label>
              総資金
              <input
                inputMode="numeric"
                value={data.totalCash}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, totalCash: e.target.value }))
                }
              />
            </label>

            <label>
              投資予定額
              <input
                inputMode="numeric"
                value={data.investPlan}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, investPlan: e.target.value }))
                }
              />
            </label>

            <label>
              現金キープ額
              <input
                inputMode="numeric"
                value={data.cashKeep}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, cashKeep: e.target.value }))
                }
              />
            </label>

            <label className="check">
              <input
                type="checkbox"
                checked={data.manualMode}
                onChange={(e) =>
                  setData((prev) => ({ ...prev, manualMode: e.target.checked }))
                }
              />
              手入力モードにする
            </label>
          </div>

          {STOCKS.map((stock) => {
            const market = data.market[stock.code]
            const holding = data.holdings[stock.code]

            return (
              <div className="card full" key={stock.code}>
                <h2>{stock.name}</h2>

                <div className="editGrid">
                  <label>
                    現在値
                    <input
                      inputMode="decimal"
                      value={market.price}
                      onChange={(e) => updateMarket(stock.code, "price", e.target.value)}
                    />
                  </label>

                  <label>
                    前日比%
                    <input
                      inputMode="decimal"
                      value={market.changePct}
                      onChange={(e) => updateMarket(stock.code, "changePct", e.target.value)}
                    />
                  </label>

                  <label>
                    出来高
                    <input
                      inputMode="numeric"
                      value={market.volume}
                      onChange={(e) => updateMarket(stock.code, "volume", e.target.value)}
                    />
                  </label>

                  <label>
                    出来高倍率
                    <input
                      inputMode="decimal"
                      value={market.volumeRate}
                      onChange={(e) => updateMarket(stock.code, "volumeRate", e.target.value)}
                    />
                  </label>

                  <label>
                    PER
                    <input
                      inputMode="decimal"
                      value={market.per}
                      onChange={(e) => updateMarket(stock.code, "per", e.target.value)}
                    />
                  </label>

                  <label>
                    25日線
                    <input
                      inputMode="decimal"
                      value={market.ma25}
                      onChange={(e) => updateMarket(stock.code, "ma25", e.target.value)}
                    />
                  </label>

                  <label>
                    購入金額
                    <input
                      inputMode="numeric"
                      value={holding.amount}
                      onChange={(e) => updateHolding(stock.code, "amount", e.target.value)}
                    />
                  </label>

                  <label>
                    株数
                    <input
                      inputMode="numeric"
                      value={holding.shares}
                      onChange={(e) => updateHolding(stock.code, "shares", e.target.value)}
                    />
                  </label>

                  <label>
                    取得単価
                    <input
                      inputMode="decimal"
                      value={holding.buyPrice}
                      onChange={(e) => updateHolding(stock.code, "buyPrice", e.target.value)}
                    />
                  </label>

                  <label>
                    購入日
                    <input
                      type="date"
                      value={holding.buyDate}
                      onChange={(e) => updateHolding(stock.code, "buyDate", e.target.value)}
                    />
                  </label>
                </div>

                <label>
                  メモ
                  <textarea
                    maxLength={80}
                    value={holding.memo}
                    onChange={(e) => updateHolding(stock.code, "memo", e.target.value)}
                    placeholder="買った理由、注意点など。80文字まで。"
                  />
                </label>
              </div>
            )
          })}

          <button className="reset" onClick={resetAll}>
            保存データを初期化
          </button>
        </section>
      ) : null}

      {activeTab === "help" ? (
        <section className="help">
          <div className="card full">
            <h2>このアプリの使い方</h2>
            <p>
              このアプリは、短期売買で感情的にならないための判断表です。
              「上がってるから買う」ではなく、ルールに合うかを見ます。
            </p>
          </div>

          <div className="card full">
            <h2>色の意味</h2>
            <p className="buyText">青緑: 買い候補。少しだけ買う場面。</p>
            <p className="waitText">青: 様子見。無理に動かない場面。</p>
            <p className="warnText">オレンジ: 注意。焦らない場面。</p>
            <p className="dangerText">赤: 危険。買いより守りの場面。</p>
          </div>

          <div className="card full">
            <h2>大切なルール</h2>
            <p>1回で全部買わない。</p>
            <p>利益が出たら少し売って守る。</p>
            <p>含み損が広がったら理由を確認する。</p>
            <p>現金20万円は守りのお金として残す。</p>
          </div>
        </section>
      ) : null}

      <style jsx>{`
        * {
          box-sizing: border-box;
        }

        .app {
          min-height: 100vh;
          padding: 18px 14px 90px;
          color: #eaf7ff;
          background:
            radial-gradient(circle at top, rgba(0, 180, 255, 0.25), transparent 32%),
            linear-gradient(180deg, #020713 0%, #07111f 48%, #020713 100%);
          font-family: Arial, "Hiragino Kaku Gothic ProN", "Yu Gothic", sans-serif;
        }

        .hero {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 18px;
          border: 1px solid rgba(0, 220, 255, 0.35);
          border-radius: 22px;
          background: rgba(5, 16, 32, 0.82);
          box-shadow: 0 0 24px rgba(0, 170, 255, 0.22);
        }

        .sub {
          margin: 0 0 6px;
          color: #64dfff;
          font-size: 12px;
          letter-spacing: 1px;
        }

        h1 {
          margin: 0;
          font-size: 24px;
          line-height: 1.2;
        }

        .lead {
          margin: 10px 0 0;
          color: #b7cad8;
          font-size: 13px;
          line-height: 1.6;
        }

        .refresh {
          flex: 0 0 auto;
          border: 1px solid rgba(0, 220, 255, 0.6);
          border-radius: 999px;
          padding: 10px 12px;
          color: #eaf7ff;
          background: rgba(0, 120, 200, 0.22);
          font-weight: 700;
        }

        .error {
          margin-top: 12px;
          padding: 12px;
          border: 1px solid rgba(255, 80, 80, 0.6);
          border-radius: 14px;
          background: rgba(90, 0, 0, 0.35);
          color: #ffd2d2;
          font-size: 13px;
        }

        .tabs {
          position: sticky;
          top: 0;
          z-index: 10;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 8px;
          padding: 12px 0;
          background: rgba(2, 7, 19, 0.92);
          backdrop-filter: blur(10px);
        }

        .tabs button {
          border: 1px solid rgba(120, 190, 220, 0.25);
          border-radius: 999px;
          padding: 10px 6px;
          color: #a9bfca;
          background: rgba(255, 255, 255, 0.04);
          font-size: 12px;
          font-weight: 800;
        }

        .tabs .on {
          color: #00131c;
          background: #60ddff;
          box-shadow: 0 0 18px rgba(0, 220, 255, 0.45);
        }

        .grid,
        .stockList,
        .edit,
        .help {
          display: grid;
          gap: 12px;
        }

        .card,
        .stockCard,
        .judge {
          border: 1px solid rgba(0, 220, 255, 0.25);
          border-radius: 20px;
          background: rgba(7, 18, 34, 0.82);
          box-shadow: inset 0 0 24px rgba(0, 170, 255, 0.05);
        }

        .card {
          padding: 16px;
        }

        .full {
          grid-column: 1 / -1;
        }

        .label {
          margin: 0 0 8px;
          color: #83a9ba;
          font-size: 12px;
        }

        h2,
        h3,
        h4 {
          margin: 0;
        }

        .card h3 {
          font-size: 22px;
        }

        .big {
          grid-column: 1 / -1;
          padding: 20px;
        }

        .judge p {
          margin: 0 0 6px;
          font-size: 11px;
          color: #b8cbd6;
        }

        .judge h2 {
          font-size: 34px;
        }

        .judge h3 {
          font-size: 19px;
        }

        .judge span {
          display: block;
          margin-top: 8px;
          color: #d7e9f0;
          font-size: 13px;
          line-height: 1.6;
        }

        .buy {
          border-color: rgba(0, 255, 210, 0.55);
          box-shadow: 0 0 22px rgba(0, 255, 210, 0.16);
        }

        .profit {
          border-color: rgba(0, 255, 150, 0.55);
          box-shadow: 0 0 22px rgba(0, 255, 150, 0.16);
        }

        .wait,
        .neutral {
          border-color: rgba(90, 170, 255, 0.45);
          box-shadow: 0 0 22px rgba(90, 170, 255, 0.12);
        }

        .warning {
          border-color: rgba(255, 180, 70, 0.7);
          box-shadow: 0 0 22px rgba(255, 180, 70, 0.16);
        }

        .danger {
          border-color: rgba(255, 70, 90, 0.75);
          box-shadow: 0 0 22px rgba(255, 70, 90, 0.22);
        }

        .plus {
          color: #65ffbd;
        }

        .minus {
          color: #ff6b7f;
        }

        .plan {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 8px;
        }

        .plan div {
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
        }

        .plan b,
        .plan span {
          display: block;
        }

        .plan span {
          margin-top: 6px;
          color: #8fdfff;
          font-weight: 800;
        }

        .row {
          display: flex;
          justify-content: space-between;
          gap: 12px;
          padding: 12px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
        }

        .updated {
          grid-column: 1 / -1;
          color: #7894a5;
          font-size: 12px;
          text-align: center;
        }

        .stockCard {
          padding: 16px;
        }

        .stockTop {
          display: grid;
          grid-template-columns: 1fr 120px;
          gap: 12px;
          align-items: stretch;
        }

        .code {
          margin: 0;
          color: #64dfff;
          font-size: 12px;
          font-weight: 800;
        }

        .theme {
          margin: 8px 0 0;
          color: #a9bfca;
          font-size: 12px;
          line-height: 1.5;
        }

        .stockTop .judge {
          padding: 12px;
          text-align: center;
        }

        .metrics {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
          margin-top: 14px;
        }

        .metrics div {
          padding: 12px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.05);
        }

        .metrics span {
          display: block;
          margin-bottom: 6px;
          color: #87a2b2;
          font-size: 11px;
        }

        .metrics b {
          font-size: 16px;
          word-break: break-all;
        }

        .message,
        .holdingBox {
          margin-top: 14px;
          padding: 14px;
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.18);
        }

        .message p,
        .help p {
          margin: 8px 0 12px;
          color: #d5e6ee;
          font-size: 13px;
          line-height: 1.7;
        }

        .memo {
          margin: 12px 0 0;
          color: #cde7f4;
          font-size: 13px;
          line-height: 1.6;
        }

        label {
          display: grid;
          gap: 6px;
          margin-top: 12px;
          color: #aac1cc;
          font-size: 13px;
          font-weight: 700;
        }

        input,
        textarea {
          width: 100%;
          border: 1px solid rgba(0, 220, 255, 0.25);
          border-radius: 14px;
          padding: 12px;
          color: #eaf7ff;
          background: rgba(0, 0, 0, 0.24);
          font-size: 16px;
          outline: none;
        }

        textarea {
          min-height: 72px;
          resize: vertical;
        }

        .editGrid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 8px;
        }

        .check {
          display: flex;
          align-items: center;
          gap: 10px;
        }

        .check input {
          width: auto;
        }

        .reset {
          width: 100%;
          border: 1px solid rgba(255, 80, 90, 0.5);
          border-radius: 16px;
          padding: 14px;
          color: #ffdce0;
          background: rgba(120, 0, 20, 0.35);
          font-weight: 800;
        }

        .buyText {
          color: #61ffd7 !important;
        }

        .waitText {
          color: #73bfff !important;
        }

        .warnText {
          color: #ffc66b !important;
        }

        .dangerText {
          color: #ff7c8f !important;
        }

        @media (min-width: 620px) {
          .app {
            max-width: 560px;
            margin: 0 auto;
          }

          .grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
      `}</style>
    </main>
  )
}