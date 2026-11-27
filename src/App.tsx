import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Plus, Trash2, Save, Receipt, History, X, Printer, Store, Share2, Volume2 } from 'lucide-react';
import { supabase, type Bill, type BillItem } from '@/lib/supabase';
import {
  createRecognition,
  parseVoiceItem,
  formatCurrency,
  buildBillText,
  numberToHindiWords,
  type SpeechRecognitionLike,
  type SpeechRecognitionEventLike,
} from '@/lib/voice';

type Lang = 'hi' | 'en';

const STR = {
  en: {
    appTitle: 'Voice Bill Maker',
    appSubtitle: 'Speak items & prices, get an instant bill',
    shopName: 'Shop name',
    listening: 'Listening… speak item and price',
    tapMic: 'Tap the mic and say',
    example: 'e.g. "Sugar 50" or "चीनी 50 रुपये"',
    addManually: 'Add item',
    itemName: 'Item name',
    price: 'Price (₹)',
    qty: 'Qty',
    items: 'Items',
    noItems: 'No items yet. Use the mic or add manually.',
    total: 'Total',
    saveBill: 'Save bill',
    clear: 'Clear',
    history: 'Bill history',
    noHistory: 'No saved bills yet.',
    back: 'Back',
    print: 'Print',
    delete: 'Delete',
    saved: 'Bill saved!',
    micUnsupported: 'Voice input is not supported in this browser. Use Chrome on Android/desktop.',
    heard: 'Heard',
    added: 'Added',
    notUnderstood: "Couldn't understand — try saying the item name and price.",
    itemsCount: (n: number) => `${n} item${n !== 1 ? 's' : ''}`,
    shareWhatsApp: 'Share on WhatsApp',
    speakTotal: 'Hear total',
    addItemsFirst: 'Add some items first.',
  },
  hi: {
    appTitle: 'वॉइस बिल मेकर',
    appSubtitle: 'आइटम और कीमत बोलें, तुरंत बिल पाएँ',
    shopName: 'दुकान का नाम',
    listening: 'सुन रहा हूँ… आइटम और कीमत बोलें',
    tapMic: 'माइक दबाएँ और बोलें',
    example: 'जैसे "चीनी 50" या "Sugar 50 rupees"',
    addManually: 'आइटम जोड़ें',
    itemName: 'आइटम का नाम',
    price: 'कीमत (₹)',
    qty: 'मात्रा',
    items: 'आइटम',
    noItems: 'अभी कोई आइटम नहीं। माइक इस्तेमाल करें या हाथ से जोड़ें।',
    total: 'कुल',
    saveBill: 'बिल सेव करें',
    clear: 'साफ़ करें',
    history: 'बिल इतिहास',
    noHistory: 'अभी कोई सेव किया बिल नहीं।',
    back: 'वापस',
    print: 'प्रिंट',
    delete: 'हटाएँ',
    saved: 'बिल सेव हो गया!',
    micUnsupported: 'इस ब्राउज़र में वॉइस इनपुट नहीं है। Chrome पर आज़माएँ।',
    heard: 'सुना',
    added: 'जोड़ा गया',
    notUnderstood: 'समझ नहीं आया — आइटम नाम और कीमत फिर से बोलें।',
    itemsCount: (n: number) => `${n} आइटम`,
    shareWhatsApp: 'व्हाट्सऐप पर भेजें',
    speakTotal: 'कुल सुनें',
    addItemsFirst: 'पहले कुछ आइटम जोड़ें।',
  },
};

function computeTotal(items: BillItem[]): number {
  return items.reduce((sum, it) => sum + it.price * it.qty, 0);
}

export default function App() {
  const [lang, setLang] = useState<Lang>('en');
  const [shopName, setShopName] = useState('My Shop');
  const [items, setItems] = useState<BillItem[]>([]);
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [view, setView] = useState<'bill' | 'history'>('bill');
  const [history, setHistory] = useState<Bill[]>([]);
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  // manual add form
  const [mName, setMName] = useState('');
  const [mPrice, setMPrice] = useState('');
  const [mQty, setMQty] = useState('1');
  const [showManual, setShowManual] = useState(false);

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const t = STR[lang];

  const flash = (msg: string, ok = true) => {
    setToast({ msg, ok });
    setTimeout(() => setToast(null), 2200);
  };

  const addItem = useCallback(
    (item: BillItem) => {
      setItems((prev) => [...prev, item]);
      flash(`${t.added}: ${item.name} — ${formatCurrency(item.price)}`);
    },
    [t.added]
  );

  const startListening = useCallback(() => {
    const existing = recognitionRef.current;
    if (existing) {
      try {
        existing.abort();
      } catch {
        // ignore
      }
    }
    const rec = createRecognition(lang);
    if (!rec) {
      flash(t.micUnsupported, false);
      return;
    }
    rec.onstart = () => setListening(true);
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.onresult = (event: SpeechRecognitionEventLike) => {
      let text = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      text = text.trim();
      setTranscript(text);
      const parsed = parseVoiceItem(text);
      if (parsed) {
        addItem({ name: parsed.name, price: parsed.price, qty: parsed.qty });
      } else {
        flash(t.notUnderstood, false);
      }
    };
    recognitionRef.current = rec;
    try {
      rec.start();
    } catch {
      setListening(false);
    }
  }, [lang, addItem, t.micUnsupported, t.notUnderstood]);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // ignore
      }
    }
    setListening(false);
  }, []);

  useEffect(() => {
    return () => {
      const rec = recognitionRef.current;
      if (rec) {
        try {
          rec.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  const loadHistory = useCallback(async () => {
    const { data, error } = await supabase
      .from('bills')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      flash('Could not load history', false);
      return;
    }
    setHistory((data ?? []) as Bill[]);
  }, [flash]);

  useEffect(() => {
    if (view === 'history') {
      void loadHistory();
    }
  }, [view, loadHistory]);

  const handleSave = async () => {
    if (items.length === 0) return;
    setSaving(true);
    const total = computeTotal(items);
    const { error } = await supabase.from('bills').insert({
      shop_name: shopName || 'My Shop',
      items,
      total,
      language: lang,
    });
    setSaving(false);
    if (error) {
      flash('Could not save bill', false);
      return;
    }
    flash(t.saved);
    setItems([]);
    setTranscript('');
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('bills').delete().eq('id', id);
    if (error) {
      flash('Could not delete', false);
      return;
    }
    setHistory((prev) => prev.filter((b) => b.id !== id));
  };

  const handleManualAdd = () => {
    const name = mName.trim();
    const price = parseFloat(mPrice);
    const qty = parseInt(mQty, 10) || 1;
    if (!name || !price || price <= 0) return;
    addItem({ name, price, qty });
    setMName('');
    setMPrice('');
    setMQty('1');
    setShowManual(false);
  };

  const total = computeTotal(items);

  const handleShareWhatsApp = () => {
    if (items.length === 0) {
      flash(t.addItemsFirst, false);
      return;
    }
    const text = buildBillText(shopName || 'My Shop', items, total);
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleSpeakTotal = () => {
    if (items.length === 0) {
      flash(t.addItemsFirst, false);
      return;
    }
    if (!('speechSynthesis' in window)) {
      flash(t.micUnsupported, false);
      return;
    }
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(
      `कुल बिल ${numberToHindiWords(total)} है`
    );
    utter.lang = 'hi-IN';
    utter.rate = 0.9;
    utter.onstart = () => setSpeaking(true);
    utter.onend = () => setSpeaking(false);
    utter.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utter);
  };

  useEffect(() => {
    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-sm">
              <Receipt size={20} />
            </div>
            <div className="leading-tight">
              <h1 className="text-base font-bold">{t.appTitle}</h1>
              <p className="text-[11px] text-slate-500">{t.appSubtitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <LangToggle lang={lang} setLang={setLang} />
            <button
              onClick={() => setView(view === 'bill' ? 'history' : 'bill')}
              className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              aria-label={t.history}
            >
              {view === 'bill' ? <History size={20} /> : <X size={20} />}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 py-4 pb-32">
        {view === 'history' ? (
          <HistoryView
            bills={history}
            t={t}
            onDelete={handleDelete}
            lang={lang}
          />
        ) : (
          <>
            {/* Shop name */}
            <div className="mb-4">
              <label className="text-xs font-medium text-slate-500 flex items-center gap-1 mb-1">
                <Store size={12} /> {t.shopName}
              </label>
              <input
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-slate-200 bg-white focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                placeholder={t.shopName}
              />
            </div>

            {/* Voice card */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 flex flex-col items-center text-center mb-4">
              <button
                onClick={listening ? stopListening : startListening}
                className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg ${
                  listening
                    ? 'bg-red-500 text-white animate-pulse scale-105'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
                }`}
                aria-label={listening ? t.listening : t.tapMic}
              >
                {listening ? <MicOff size={32} /> : <Mic size={32} />}
              </button>
              <p className="mt-4 text-sm font-medium text-slate-700">
                {listening ? t.listening : t.tapMic}
              </p>
              <p className="text-xs text-slate-400 mt-1">{t.example}</p>
              {transcript && (
                <p className="mt-3 text-xs text-slate-500 bg-slate-50 rounded-lg px-3 py-2">
                  <span className="font-medium text-slate-600">{t.heard}: </span>
                  "{transcript}"
                </p>
              )}
            </div>

            {/* Manual add toggle */}
            <button
              onClick={() => setShowManual((s) => !s)}
              className="w-full mb-3 flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-slate-300 text-slate-600 text-sm font-medium hover:border-emerald-400 hover:text-emerald-600 transition-colors"
            >
              <Plus size={16} /> {t.addManually}
            </button>

            {showManual && (
              <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4 mb-4 space-y-3">
                <input
                  value={mName}
                  onChange={(e) => setMName(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                  placeholder={t.itemName}
                />
                <div className="flex gap-2">
                  <input
                    value={mPrice}
                    onChange={(e) => setMPrice(e.target.value)}
                    type="number"
                    inputMode="decimal"
                    className="flex-1 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                    placeholder={t.price}
                  />
                  <input
                    value={mQty}
                    onChange={(e) => setMQty(e.target.value)}
                    type="number"
                    inputMode="numeric"
                    className="w-20 px-3 py-2.5 rounded-xl border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none text-sm"
                    placeholder={t.qty}
                  />
                </div>
                <button
                  onClick={handleManualAdd}
                  className="w-full py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
                >
                  {t.addManually}
                </button>
              </div>
            )}

            {/* Items list */}
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-sm font-semibold text-slate-700">
                  {t.items}{' '}
                  <span className="text-slate-400 font-normal">
                    ({t.itemsCount(items.length)})
                  </span>
                </h2>
                {items.length > 0 && (
                  <button
                    onClick={() => setItems([])}
                    className="text-xs text-slate-400 hover:text-red-500"
                  >
                    {t.clear}
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-8 text-center text-sm text-slate-400">
                  {t.noItems}
                </div>
              ) : (
                <ul className="space-y-2">
                  {items.map((item, idx) => (
                    <li
                      key={idx}
                      className="bg-white rounded-xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-slate-800 truncate">
                          {item.name}
                        </p>
                        <p className="text-xs text-slate-400">
                          {formatCurrency(item.price)} × {item.qty}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">
                        {formatCurrency(item.price * item.qty)}
                      </span>
                      <button
                        onClick={() =>
                          setItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50"
                        aria-label={t.delete}
                      >
                        <Trash2 size={16} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </main>

      {/* Bottom total + save bar (bill view only) */}
      {view === 'bill' && (
        <div className="fixed bottom-0 inset-x-0 z-20 bg-white border-t border-slate-200 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
          <div className="max-w-md mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex-1">
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wide">
                {t.total}
              </p>
              <p className="text-xl font-bold text-slate-900">
                {formatCurrency(total)}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleSpeakTotal}
                disabled={items.length === 0 || speaking}
                className={`flex items-center justify-center w-11 h-11 rounded-xl text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
                  speaking ? 'bg-blue-600 animate-pulse' : 'bg-blue-500 hover:bg-blue-600'
                }`}
                aria-label={t.speakTotal}
                title={t.speakTotal}
              >
                <Volume2 size={18} />
              </button>
              <button
                onClick={handleShareWhatsApp}
                disabled={items.length === 0}
                className="flex items-center justify-center w-11 h-11 rounded-xl bg-green-500 text-white hover:bg-green-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label={t.shareWhatsApp}
                title={t.shareWhatsApp}
              >
                <Share2 size={18} />
              </button>
              <button
                onClick={handleSave}
                disabled={items.length === 0 || saving}
                className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Save size={18} /> {t.saveBill}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-16 left-1/2 -translate-x-1/2 z-30 px-4 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
            toast.ok
              ? 'bg-emerald-600 text-white'
              : 'bg-red-500 text-white'
          }`}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}

function LangToggle({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
      <button
        onClick={() => setLang('en')}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          lang === 'en' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLang('hi')}
        className={`px-2.5 py-1 rounded-md transition-colors ${
          lang === 'hi' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-400'
        }`}
      >
        हिं
      </button>
    </div>
  );
}

function HistoryView({
  bills,
  t,
  onDelete,
  lang,
}: {
  bills: Bill[];
  t: (typeof STR)['en'];
  onDelete: (id: string) => void;
  lang: Lang;
}) {
  if (bills.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-dashed border-slate-200 p-10 text-center text-sm text-slate-400 mt-4">
        {t.noHistory}
      </div>
    );
  }
  return (
    <ul className="space-y-3 mt-2">
      {bills.map((bill) => (
        <li
          key={bill.id}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
        >
          <div className="px-4 py-3 flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-800 truncate">
                {bill.shop_name}
              </p>
              <p className="text-xs text-slate-400">
                {new Date(bill.created_at).toLocaleString(lang === 'hi' ? 'hi-IN' : 'en-IN')}
                {' · '}
                {t.itemsCount(bill.items.length)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-base font-bold text-slate-900">
                {formatCurrency(bill.total)}
              </p>
            </div>
          </div>
          <div className="px-4 pb-3">
            <ul className="text-xs text-slate-500 space-y-0.5">
              {bill.items.map((it, i) => (
                <li key={i} className="flex justify-between">
                  <span className="truncate">
                    {it.name} × {it.qty}
                  </span>
                  <span className="whitespace-nowrap">
                    {formatCurrency(it.price * it.qty)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="px-4 py-2 border-t border-slate-100 flex items-center justify-end gap-1">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 px-2 py-1 rounded-lg"
            >
              <Printer size={14} /> {t.print}
            </button>
            <button
              onClick={() => onDelete(bill.id)}
              className="flex items-center gap-1 text-xs text-slate-500 hover:text-red-500 px-2 py-1 rounded-lg"
            >
              <Trash2 size={14} /> {t.delete}
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}
