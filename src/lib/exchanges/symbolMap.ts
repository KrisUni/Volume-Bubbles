// Maps Binance symbol (e.g. 'BTCUSDT') to per-exchange symbols/instruments
export interface SymbolMapping {
  binance: string;
  kraken?: string;
  bybit?: string;
  okx?: string;
  bitstamp?: string;
}

export const SYMBOL_MAP: Record<string, SymbolMapping> = {
  BTCUSDT: {
    binance: 'BTCUSDT',
    kraken: 'BTC/USDT',
    bybit: 'BTCUSDT',
    okx: 'BTC-USDT',
    bitstamp: 'btcusd',
  },
  ETHUSDT: {
    binance: 'ETHUSDT',
    kraken: 'ETH/USDT',
    bybit: 'ETHUSDT',
    okx: 'ETH-USDT',
    bitstamp: 'ethusd',
  },
  SOLUSDT: {
    binance: 'SOLUSDT',
    kraken: 'SOL/USDT',
    bybit: 'SOLUSDT',
    okx: 'SOL-USDT',
  },
  BNBUSDT: {
    binance: 'BNBUSDT',
    bybit: 'BNBUSDT',
    okx: 'BNB-USDT',
  },
  XRPUSDT: {
    binance: 'XRPUSDT',
    kraken: 'XRP/USDT',
    bybit: 'XRPUSDT',
    okx: 'XRP-USDT',
    bitstamp: 'xrpusd',
  },
  ADAUSDT: {
    binance: 'ADAUSDT',
    kraken: 'ADA/USDT',
    bybit: 'ADAUSDT',
    okx: 'ADA-USDT',
  },
  DOGEUSDT: {
    binance: 'DOGEUSDT',
    kraken: 'DOGE/USDT',
    bybit: 'DOGEUSDT',
    okx: 'DOGE-USDT',
    bitstamp: 'dogeusd',
  },
  LTCUSDT: {
    binance: 'LTCUSDT',
    kraken: 'LTC/USDT',
    bybit: 'LTCUSDT',
    okx: 'LTC-USDT',
    bitstamp: 'ltcusd',
  },
};
