'use client';
import { useState, useEffect, useRef, useMemo } from 'react';
import './globals.css';

export default function Home() {
  const [cryptoData, setCryptoData] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedCoin, setSelectedCoin] = useState(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [adsDisabled, setAdsDisabled] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showInterstitial, setShowInterstitial] = useState(false);
  const [pendingCoin, setPendingCoin] = useState(null);
  const [showFloatingAd, setShowFloatingAd] = useState(true);
  const itemsPerPage = 15;

  const handleCoinClick = (coin) => {
    if (adsDisabled) {
      setSelectedCoin(coin);
    } else {
      setPendingCoin(coin);
      setShowInterstitial(true);
      setTimeout(() => {
        setShowInterstitial(false);
        setSelectedCoin(coin);
        setPendingCoin(null);
      }, 5000);
    }
  };

  const wsRef = useRef(null);
  const initialLoadRef = useRef(true);

  useEffect(() => {
    const generateMockData = () => {
      return Array.from({ length: 150 }, (_, i) => {
        const isUp = i % 3 !== 0;
        const p1 = (i * 17) % 1000;
        const p2 = (i * 7) % 10;
        const p3 = (i * 13) % 50;
        const sym = ["BTC", "ETH", "SOL", "ADA", "DOT", "LINK", "AVAX"][i % 7] + (i > 6 ? i : '');

        return {
          id: sym, symbol: sym, name: `${sym} Token`,
          priceRaw: p1 + 10, price: `$${(p1 + 10).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
          changeRaw: isUp ? p2 : -p2, change: `${isUp ? '+' : '-'}${p2.toFixed(2)}%`,
          isUp, volume: `$${(p3 + 1).toFixed(2)}M`,
          high: `$${(p1 + 20).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
          low: `$${(p1 + 5).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
          trades: i * 1000
        };
      });
    };

    const fetchInitialData = async () => {
      try {
        const res = await fetch('https://api.binance.com/api/v3/ticker/24hr');
        if (!res.ok) throw new Error('Failed to fetch initial data');
        const data = await res.json();
        
        const usdtPairs = data
          .filter(coin => coin.symbol.endsWith('USDT'))
          .sort((a, b) => parseFloat(b.quoteVolume) - parseFloat(a.quoteVolume))
          .map(coin => formatCoinData(coin.symbol, coin.lastPrice, coin.priceChangePercent, coin.quoteVolume, coin.highPrice, coin.lowPrice, coin.count));
        
        setCryptoData(usdtPairs);
        setIsLoading(false);
        initialLoadRef.current = false;
        
        connectWebSocket();
      } catch (err) {
        console.warn('Live API fetch failed, falling back to mock data.', err);
        setCryptoData(generateMockData());
        setIsLoading(false);
        initialLoadRef.current = false;
      }
    };

    const connectWebSocket = () => {
      const ws = new WebSocket('wss://stream.binance.com:9443/ws/!ticker@arr');
      wsRef.current = ws;

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        
        setCryptoData(prevData => {
          const wsMap = new Map();
          data.forEach(item => {
            if (item.s.endsWith('USDT')) {
               wsMap.set(item.s, item);
            }
          });

          return prevData.map(coin => {
            const update = wsMap.get(`${coin.symbol}USDT`);
            if (update) {
              return formatCoinData(update.s, update.c, update.P, update.q, update.h, update.l, update.n);
            }
            return coin;
          });
        });
      };

      ws.onerror = (err) => {
        console.error('WebSocket error:', err);
      };

      ws.onclose = () => {
        setTimeout(connectWebSocket, 5000);
      };
    };

    fetchInitialData();

    return () => {
      if (wsRef.current) wsRef.current.close();
    };
  }, []);

  const formatCoinData = (rawSymbol, priceStr, changePercentStr, volumeStr, highStr, lowStr, tradesCount) => {
    const symbol = rawSymbol.replace('USDT', '');
    const priceChangePercent = parseFloat(changePercentStr);
    const isUp = priceChangePercent >= 0;
    
    return {
      id: symbol,
      symbol: symbol,
      name: `${symbol} Token`,
      priceRaw: parseFloat(priceStr),
      price: `$${parseFloat(priceStr).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      changeRaw: priceChangePercent,
      change: `${isUp ? '+' : ''}${priceChangePercent.toFixed(2)}%`,
      isUp,
      volume: `$${(parseFloat(volumeStr) / 1000000).toFixed(2)}M`,
      high: `$${parseFloat(highStr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      low: `$${parseFloat(lowStr || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`,
      trades: tradesCount || 0
    };
  };

  const filtered = useMemo(() => {
    let result = cryptoData.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.symbol.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (activeTab === 'Gainers') {
      result = result.filter(c => c.isUp).sort((a, b) => b.changeRaw - a.changeRaw);
    } else if (activeTab === 'Losers') {
      result = result.filter(c => !c.isUp).sort((a, b) => a.changeRaw - b.changeRaw);
    } // 'All' maintains the original volume sort

    return result;
  }, [cryptoData, searchTerm, activeTab]);

  const totalPages = Math.ceil(filtered.length / itemsPerPage);
  const displayed = filtered.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="container">
      <header style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', position: 'relative'}}>
        <div style={{display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center'}}>
          <div className="logo" onClick={() => setActiveTab('All')} style={{cursor: 'pointer'}}>CryptoPulse</div>
          <button className="burger-btn" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
            {isMobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
        <nav className={`nav-links ${isMobileMenuOpen ? 'open' : ''}`}>
          <a href="#" className={activeTab === 'All' ? 'active' : ''} style={{color: activeTab === 'All' ? '#fff' : ''}} onClick={(e) => {e.preventDefault(); setActiveTab('All'); setCurrentPage(1); setIsMobileMenuOpen(false);}}>Volume Top</a>
          <a href="#" className={activeTab === 'Gainers' ? 'active' : ''} style={{color: activeTab === 'Gainers' ? '#0ecb81' : ''}} onClick={(e) => {e.preventDefault(); setActiveTab('Gainers'); setCurrentPage(1); setIsMobileMenuOpen(false);}}>Top Gainers</a>
          <a href="#" className={activeTab === 'Losers' ? 'active' : ''} style={{color: activeTab === 'Losers' ? '#f6465d' : ''}} onClick={(e) => {e.preventDefault(); setActiveTab('Losers'); setCurrentPage(1); setIsMobileMenuOpen(false);}}>Top Losers</a>
        </nav>
      </header>

      <section className="dashboard-header">
        <div>
          <h1>Live Global Markets</h1>
          <p style={{color: '#0ecb81', fontWeight: 'bold'}}>● Real-Time WebSocket Stream Active</p>
        </div>
        <div className="search-wrap">
          <input 
            type="text" 
            className="search-bar" 
            placeholder="Search coin or symbol..." 
            value={searchTerm}
            onChange={(e) => {setSearchTerm(e.target.value); setCurrentPage(1);}}
          />
        </div>
      </section>

      {isLoading ? (
        <div className="loading-state" style={{textAlign: 'center', padding: '4rem', color: 'var(--secondary)'}}>
          <h2>Initializing Real-Time WebSocket Connection...</h2>
          <p>Syncing blockchain order books.</p>
        </div>
      ) : error ? (
        <div className="error-state" style={{textAlign: 'center', padding: '4rem', color: 'var(--down)'}}>
          <h2>{error}</h2>
        </div>
      ) : (
        <main className="market-grid">
          {displayed.map((coin, index) => (
            <div key={`coin-group-${coin.id}`} style={{ display: 'contents' }}>
              <div className="coin-card" style={{cursor: 'pointer'}} onClick={() => handleCoinClick(coin)}>
                <div className="coin-header">
                  <h3>{coin.symbol}</h3>
                  <span className={coin.isUp ? 'change up' : 'change down'}>{coin.change}</span>
                </div>
                <div className="coin-name">{coin.name}</div>
                <div className="coin-price">{coin.price}</div>
                <div className="coin-vol">24h Vol: {coin.volume}</div>
              </div>

              {!adsDisabled && (index + 1) % 6 === 0 && (
                <div key={`ad-${coin.id}`} className="crypto-ad-bar">
                  <span className="ad-label">SPONSORED EXCHANGE</span>
                  <div className="ad-content">Trade {coin.symbol} with 0% Fees on BestExchange.</div>
                </div>
              )}
            </div>
          ))}
        </main>
      )}

      {!isLoading && !error && totalPages > 1 && (
        <div className="pagination">
          <button disabled={currentPage === 1} onClick={() => {setCurrentPage(p => p - 1); window.scrollTo(0,0);}}>Prev</button>
          <span>Page {currentPage} of {totalPages}</span>
          <button disabled={currentPage === totalPages} onClick={() => {setCurrentPage(p => p + 1); window.scrollTo(0,0);}}>Next</button>
        </div>
      )}

      {/* Coin Analysis Modal */}
      {selectedCoin && (
        <div className="modal-overlay" onClick={() => setSelectedCoin(null)} style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(11,14,20,0.95)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{background: 'var(--card)', padding: '3rem', borderRadius: '16px', maxWidth: '600px', width: '90%', border: '1px solid #2b3139', position: 'relative'}}>
            <button onClick={() => setSelectedCoin(null)} style={{position: 'absolute', top: '1.5rem', right: '1.5rem', background: 'none', border: 'none', color: 'var(--secondary)', fontSize: '2rem', cursor: 'pointer'}}>&times;</button>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem'}}>
              <div>
                <h2 style={{fontFamily: 'Space Grotesk, sans-serif', fontSize: '2.5rem', margin: 0, color: 'var(--accent)'}}>{selectedCoin.symbol}</h2>
                <span style={{color: 'var(--secondary)'}}>{selectedCoin.name}</span>
              </div>
              <div style={{textAlign: 'right'}}>
                <div style={{fontFamily: 'Space Grotesk, sans-serif', fontSize: '2rem', fontWeight: 700, color: '#fff'}}>{selectedCoin.price}</div>
                <span className={selectedCoin.isUp ? 'change up' : 'change down'} style={{fontSize: '1.1rem'}}>{selectedCoin.change}</span>
              </div>
            </div>

            <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '2rem'}}>
              <div style={{background: '#0b0e14', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2b3139'}}>
                <div style={{color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>24h High</div>
                <div style={{color: '#fff', fontSize: '1.2rem', fontFamily: 'Space Grotesk, sans-serif'}}>{selectedCoin.high}</div>
              </div>
              <div style={{background: '#0b0e14', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2b3139'}}>
                <div style={{color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>24h Low</div>
                <div style={{color: '#fff', fontSize: '1.2rem', fontFamily: 'Space Grotesk, sans-serif'}}>{selectedCoin.low}</div>
              </div>
              <div style={{background: '#0b0e14', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2b3139'}}>
                <div style={{color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>24h Volume (USDT)</div>
                <div style={{color: '#fff', fontSize: '1.2rem', fontFamily: 'Space Grotesk, sans-serif'}}>{selectedCoin.volume}</div>
              </div>
              <div style={{background: '#0b0e14', padding: '1.5rem', borderRadius: '8px', border: '1px solid #2b3139'}}>
                <div style={{color: 'var(--secondary)', fontSize: '0.9rem', marginBottom: '0.5rem'}}>24h Trades</div>
                <div style={{color: '#fff', fontSize: '1.2rem', fontFamily: 'Space Grotesk, sans-serif'}}>{selectedCoin.trades.toLocaleString()}</div>
              </div>
            </div>

            <button style={{width: '100%', background: 'var(--accent)', color: '#000', border: 'none', padding: '1.2rem', borderRadius: '8px', fontSize: '1.1rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', cursor: 'pointer'}}>Trade {selectedCoin.symbol} Now</button>
          </div>
        </div>
      )}

      {/* Interstitial Ad Modal */}
      {showInterstitial && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.95)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="modal-content" style={{background: '#111', padding: '3rem', borderRadius: '20px', maxWidth: '600px', width: '90%', textAlign: 'center', border: '1px solid #333', position: 'relative'}}>
            <span className="ad-tag" style={{display: 'inline-block', marginBottom: '1.5rem', color: 'var(--accent)', fontWeight: 'bold', letterSpacing: '2px'}}>SPONSORED EXCHANGE</span>
            <h2 style={{fontSize: '2rem', marginBottom: '1rem'}}>Trade Crypto with 0 Fees</h2>
            <p style={{color: '#aaa', marginBottom: '2rem'}}>Join millions of traders getting the best rates on the market.</p>
            <div style={{display: 'flex', gap: '1rem', justifyContent: 'center'}}>
              <button onClick={() => {setShowInterstitial(false); setSelectedCoin(pendingCoin); setPendingCoin(null);}} style={{padding: '1rem 2rem', background: 'transparent', border: '1px solid #444', color: '#fff', borderRadius: '8px', cursor: 'pointer'}}>Skip Ad</button>
              <button style={{padding: '1rem 2rem', background: 'var(--accent)', border: 'none', color: '#000', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer'}}>Sign Up</button>
            </div>
          </div>
        </div>
      )}

      {/* Premium Upgrade Modal */}
      {showPremiumModal && (
        <div className="modal-overlay" style={{position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.85)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <div className="modal-content" style={{background: '#111', padding: '4rem 3rem', borderRadius: '20px', maxWidth: '500px', width: '90%', textAlign: 'center', border: '1px solid var(--accent)', position: 'relative'}}>
            <button onClick={() => setShowPremiumModal(false)} style={{position: 'absolute', top: '1rem', right: '1.5rem', background: 'none', border: 'none', color: '#fff', fontSize: '2rem', cursor: 'pointer'}}>&times;</button>
            <h2 style={{fontSize: '2.5rem', marginBottom: '1rem'}}>CryptoPulse <span style={{color: 'var(--accent)'}}>PRO</span></h2>
            <p style={{color: '#aaa', fontSize: '1.1rem', marginBottom: '2rem'}}>Unlock real-time sub-millisecond data updates and disable all promotional ads.</p>
            <button onClick={() => {setAdsDisabled(true); setShowPremiumModal(false); setShowFloatingAd(false);}} style={{width: '100%', padding: '1.2rem', background: 'var(--accent)', border: 'none', color: '#000', fontSize: '1.2rem', fontWeight: 'bold', borderRadius: '8px', cursor: 'pointer', marginBottom: '1rem'}}>
              Upgrade for $4.99/mo
            </button>
            <p style={{color: '#666', fontSize: '0.9rem'}}>Cancel anytime.</p>
          </div>
        </div>
      )}

      {/* Floating Ad Banner */}
      {!adsDisabled && showFloatingAd && (
        <div style={{position: 'fixed', bottom: '20px', left: '50%', transform: 'translateX(-50%)', width: 'calc(100% - 40px)', maxWidth: '700px', background: 'rgba(20,20,20,0.95)', backdropFilter: 'blur(10px)', border: '1px solid #333', borderRadius: '16px', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, boxShadow: '0 20px 40px rgba(0,0,0,0.5)'}}>
          <div style={{display: 'flex', alignItems: 'center', gap: '1rem'}}>
            <div style={{width: '40px', height: '40px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 'bold'}}>$</div>
            <div>
              <p style={{fontSize: '0.8rem', color: '#888', margin: 0, textTransform: 'uppercase', letterSpacing: '1px'}}>Sponsored</p>
              <strong style={{color: '#fff', fontSize: '0.95rem'}}>Earn 12% APY on Stablecoins</strong>
            </div>
          </div>
          <div style={{display: 'flex', gap: '1rem', alignItems: 'center'}}>
            <button style={{background: '#fff', color: '#000', border: 'none', padding: '0.5rem 1rem', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.85rem'}}>Start Earning</button>
            <button onClick={() => setShowFloatingAd(false)} style={{background: 'none', border: 'none', color: '#888', fontSize: '1.5rem', cursor: 'pointer'}}>&times;</button>
          </div>
        </div>
      )}

      <footer className="crypto-footer">
        <div className="footer-grid">
          <div className="footer-brand">CryptoPulse</div>
          <div className="footer-col">
            <h4>Platform</h4>
            <a href="#">Trade</a><a href="#">Earn</a><a href="#">Institutional</a>
          </div>
          <div className="footer-col">
            <h4>Learn</h4>
            <a href="#">Academy</a><a href="#">Research</a>
            {adsDisabled ? (
              <span style={{color: 'var(--accent)', fontWeight: 'bold'}}>Pro Active</span>
            ) : (
              <a href="#" onClick={(e) => {e.preventDefault(); setShowPremiumModal(true);}} style={{color: 'var(--accent)'}}>Go Ad-Free</a>
            )}
          </div>
          <div className="footer-col">
            <h4>Support</h4>
            <a href="#">Help Center</a><a href="#">API Documentation</a><a href="#">Fees</a>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2026 CryptoPulse Financial. Live Data Provided by Binance WebSocket API. | <a href="#">Terms</a> | <a href="#">Privacy</a></p>
        </div>
      </footer>
    </div>
  );
}
