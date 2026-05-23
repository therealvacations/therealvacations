import { useState, useRef } from "react";

const BRAND = {
  purple: "#3b0764",
  purpleMid: "#6d28d9",
  purpleLight: "#c4b5fd",
  purpleFade: "#f5f3ff",
  green: "#065f46",
  gold: "#b45309",
  white: "#ffffff",
  gray50: "#f9fafb",
  gray100: "#f3f4f6",
  gray200: "#e5e7eb",
  gray400: "#9ca3af",
  gray600: "#4b5563",
  gray900: "#111827",
};

const uid = () => Math.random().toString(36).slice(2, 8);

const defaultFlight = () => ({
  id: uid(), from: "", to: "", date: "", returnDate: "", passengers: 1,
  cabin: "Economy", airline: "", basePrice: "", notes: ""
});

const defaultHotel = () => ({
  id: uid(), name: "", location: "", checkIn: "", checkOut: "",
  roomType: "", beds: "", guests: 2, nights: 1, basePrice: "", notes: ""
});

const defaultExtra = () => ({
  id: uid(), description: "", quantity: 1, basePrice: "", notes: ""
});

const fmt = (n) => isNaN(n) ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Section({ title, children, onAdd, addLabel, color = BRAND.purpleMid }) {
  return (
    <div style={{ marginBottom: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 4, height: 22, background: color, borderRadius: 2 }} />
          <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: BRAND.gray900, letterSpacing: "0.02em", textTransform: "uppercase" }}>{title}</h3>
        </div>
        {onAdd && (
          <button onClick={onAdd} style={{
            background: color, color: "#fff", border: "none", borderRadius: 8,
            padding: "6px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer",
            display: "flex", alignItems: "center", gap: 5
          }}>
            + {addLabel}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function Field({ label, children, half, third }) {
  return (
    <div style={{
      flex: third ? "1 1 30%" : half ? "1 1 45%" : "1 1 100%",
      minWidth: third ? 140 : half ? 180 : "100%",
      display: "flex", flexDirection: "column", gap: 5
    }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: BRAND.gray600, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</label>
      {children}
    </div>
  );
}

const input = {
  width: "100%", padding: "9px 12px", border: `1.5px solid ${BRAND.gray200}`,
  borderRadius: 8, fontSize: 14, color: BRAND.gray900, background: BRAND.white,
  outline: "none", boxSizing: "border-box", fontFamily: "inherit",
  transition: "border-color 0.15s"
};

function TextInput({ value, onChange, placeholder, type = "text" }) {
  const [focus, setFocus] = useState(false);
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{ ...input, borderColor: focus ? BRAND.purpleMid : BRAND.gray200 }}
      onFocus={() => setFocus(true)} onBlur={() => setFocus(false)} />
  );
}

function SelectInput({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ ...input, appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M6 8L1 3h10z'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 10px center", paddingRight: 28 }}>
      {options.map(o => <option key={o.value || o} value={o.value || o}>{o.label || o}</option>)}
    </select>
  );
}

function CardWrap({ children, onRemove }) {
  return (
    <div style={{
      background: BRAND.white, border: `1.5px solid ${BRAND.gray200}`,
      borderRadius: 12, padding: "20px 20px 16px", marginBottom: 12, position: "relative"
    }}>
      {onRemove && (
        <button onClick={onRemove} style={{
          position: "absolute", top: 12, right: 12,
          background: "none", border: "none", color: BRAND.gray400,
          cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 2
        }} title="Remove">×</button>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
        {children}
      </div>
    </div>
  );
}

// ── PRINT / PREVIEW QUOTE ──────────────────────────────────────────────
function QuotePreview({ quote, markup, flights, hotels, extras, total, clientTotal, onClose }) {
  const printRef = useRef();
  const handlePrint = () => window.print();
  const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", zIndex: 1000,
      display: "flex", alignItems: "flex-start", justifyContent: "center",
      overflow: "auto", padding: "32px 16px"
    }}>
      <div style={{ width: "100%", maxWidth: 780, background: BRAND.white, borderRadius: 16, overflow: "hidden" }}>
        {/* Controls */}
        <div style={{
          background: BRAND.purple, padding: "14px 24px",
          display: "flex", alignItems: "center", justifyContent: "space-between"
        }}>
          <span style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>Quote Preview</span>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handlePrint} style={{
              background: BRAND.purpleMid, color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer"
            }}>🖨 Print / Save PDF</button>
            <button onClick={onClose} style={{
              background: "rgba(255,255,255,0.15)", color: "#fff", border: "none",
              borderRadius: 8, padding: "8px 16px", fontSize: 13, cursor: "pointer"
            }}>Close</button>
          </div>
        </div>

        {/* Quote Document */}
        <div ref={printRef} id="quote-print" style={{ padding: "40px 48px", fontFamily: "Georgia, serif" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 32, paddingBottom: 24, borderBottom: `2px solid ${BRAND.purple}` }}>
            <div>
              <div style={{ fontSize: 22, fontWeight: 700, color: BRAND.purple, marginBottom: 2 }}>The Real Vacations</div>
              <div style={{ fontSize: 12, color: BRAND.gray600, letterSpacing: "0.1em" }}>BORN FROM FAMILY · BUILT FOR COMMUNITY</div>
              <div style={{ fontSize: 12, color: BRAND.gray600, marginTop: 4 }}>contact@therealvacations.com · 404-923-0017</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: BRAND.gray400, textTransform: "uppercase", marginBottom: 4 }}>Travel Quote</div>
              <div style={{ fontSize: 11, color: BRAND.gray600 }}>Prepared: {now}</div>
              <div style={{ fontSize: 11, color: BRAND.gray600 }}>Agent: {quote.agent || "—"}</div>
            </div>
          </div>

          {/* Client */}
          <div style={{ background: BRAND.purpleFade, borderRadius: 10, padding: "16px 20px", marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: BRAND.gray400, textTransform: "uppercase", marginBottom: 4 }}>Prepared For</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: BRAND.purple }}>{quote.client || "Valued Client"}</div>
            {quote.destination && <div style={{ fontSize: 13, color: BRAND.gray600, marginTop: 2 }}>Destination: {quote.destination}</div>}
          </div>

          {/* Flights */}
          {flights.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
                ✈️ Flights
              </div>
              {flights.map((f, i) => (
                <div key={f.id} style={{ borderBottom: `1px solid ${BRAND.gray100}`, paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.gray900 }}>
                        {f.from || "Origin"} → {f.to || "Destination"}
                        {f.returnDate && ` (Round Trip)`}
                      </div>
                      <div style={{ fontSize: 12, color: BRAND.gray600, marginTop: 3 }}>
                        {f.date}{f.returnDate ? ` → ${f.returnDate}` : ""} · {f.passengers} passenger{f.passengers > 1 ? "s" : ""} · {f.cabin}
                        {f.airline && ` · ${f.airline}`}
                      </div>
                      {f.notes && <div style={{ fontSize: 12, color: BRAND.gray400, marginTop: 2, fontStyle: "italic" }}>{f.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 90 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(Number(f.basePrice) * (1 + markup / 100))}</div>
                      <div style={{ fontSize: 11, color: BRAND.gray400 }}>per person</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Hotels */}
          {hotels.length > 0 && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                🏨 Accommodations
              </div>
              {hotels.map((h) => (
                <div key={h.id} style={{ borderBottom: `1px solid ${BRAND.gray100}`, paddingBottom: 12, marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 15, color: BRAND.gray900 }}>{h.name || "Accommodation"}</div>
                      <div style={{ fontSize: 12, color: BRAND.gray600, marginTop: 3 }}>
                        {h.location && `${h.location} · `}{h.checkIn} → {h.checkOut} · {h.nights} night{h.nights > 1 ? "s" : ""}
                        {h.roomType && ` · ${h.roomType}`}{h.beds && ` · ${h.beds}`}
                        {h.guests && ` · ${h.guests} guests`}
                      </div>
                      {h.notes && <div style={{ fontSize: 12, color: BRAND.gray400, marginTop: 2, fontStyle: "italic" }}>{h.notes}</div>}
                    </div>
                    <div style={{ textAlign: "right", minWidth: 90 }}>
                      <div style={{ fontWeight: 700, fontSize: 15 }}>{fmt(Number(h.basePrice) * h.nights * (1 + markup / 100))}</div>
                      <div style={{ fontSize: 11, color: BRAND.gray400 }}>{h.nights} night{h.nights > 1 ? "s" : ""}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Extras */}
          {extras.length > 0 && extras.some(e => e.description) && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: BRAND.purple, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 12 }}>
                🎟 Additional Services
              </div>
              {extras.filter(e => e.description).map((e) => (
                <div key={e.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: `1px solid ${BRAND.gray100}`, paddingBottom: 10, marginBottom: 10 }}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{e.description}</div>
                    {e.notes && <div style={{ fontSize: 12, color: BRAND.gray400, fontStyle: "italic" }}>{e.notes}</div>}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{fmt(Number(e.basePrice) * e.quantity * (1 + markup / 100))}</div>
                </div>
              ))}
            </div>
          )}

          {/* Total */}
          <div style={{ background: BRAND.purple, borderRadius: 10, padding: "20px 24px", color: "#fff", marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, opacity: 0.75, marginBottom: 4 }}>Total Package Investment</div>
                <div style={{ fontSize: 28, fontWeight: 700 }}>{fmt(clientTotal)}</div>
              </div>
              {quote.notes && <div style={{ fontSize: 12, opacity: 0.8, maxWidth: 300, textAlign: "right" }}>{quote.notes}</div>}
            </div>
          </div>

          {/* Book Link */}
          {quote.bookLink && (
            <div style={{ textAlign: "center", marginBottom: 24 }}>
              <div style={{ fontSize: 12, color: BRAND.gray600, marginBottom: 6 }}>Ready to book? Use the link below:</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: BRAND.purpleMid, wordBreak: "break-all" }}>{quote.bookLink}</div>
            </div>
          )}

          {/* Footer */}
          <div style={{ borderTop: `1px solid ${BRAND.gray200}`, paddingTop: 16, fontSize: 11, color: BRAND.gray400, textAlign: "center" }}>
            This quote is valid for 48 hours. Prices are subject to availability at time of booking. Travel insurance is strongly recommended. · therealvacations.com
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #quote-print, #quote-print * { visibility: visible; }
          #quote-print { position: fixed; inset: 0; padding: 32px; }
        }
      `}</style>
    </div>
  );
}

// ── MAIN APP ─────────────────────────────────────────────────────────
export default function QuoteBuilder() {
  const [quote, setQuote] = useState({ agent: "", client: "", destination: "", bookLink: "", notes: "" });
  const [markup, setMarkup] = useState(17);
  const [flights, setFlights] = useState([defaultFlight()]);
  const [hotels, setHotels] = useState([defaultHotel()]);
  const [extras, setExtras] = useState([defaultExtra()]);
  const [showPreview, setShowPreview] = useState(false);
  const [tab, setTab] = useState("build"); // build | summary

  const updateQ = (k, v) => setQuote(q => ({ ...q, [k]: v }));

  const updateFlight = (id, k, v) => setFlights(fs => fs.map(f => f.id === id ? { ...f, [k]: v } : f));
  const removeFlight = (id) => setFlights(fs => fs.filter(f => f.id !== id));

  const updateHotel = (id, k, v) => setHotels(hs => hs.map(h => h.id === id ? { ...h, [k]: v } : h));
  const removeHotel = (id) => setHotels(hs => hs.filter(h => h.id !== id));

  const updateExtra = (id, k, v) => setExtras(es => es.map(e => e.id === id ? { ...e, [k]: v } : e));
  const removeExtra = (id) => setExtras(es => es.filter(e => e.id !== id));

  // Cost calculations
  const flightBase = flights.reduce((sum, f) => sum + (Number(f.basePrice) || 0) * (Number(f.passengers) || 1), 0);
  const hotelBase = hotels.reduce((sum, h) => sum + (Number(h.basePrice) || 0) * (Number(h.nights) || 1), 0);
  const extrasBase = extras.reduce((sum, e) => sum + (Number(e.basePrice) || 0) * (Number(e.quantity) || 1), 0);
  const totalBase = flightBase + hotelBase + extrasBase;
  const clientTotal = totalBase * (1 + markup / 100);
  const profit = clientTotal - totalBase;

  return (
    <div style={{ minHeight: "100vh", background: BRAND.gray50, fontFamily: "'Segoe UI', system-ui, sans-serif" }}>

      {/* Header */}
      <div style={{ background: BRAND.purple, padding: "0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 36, height: 36, background: "rgba(255,255,255,0.15)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18 }}>✈</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, letterSpacing: "-0.01em" }}>The Real Vacations</div>
            <div style={{ color: BRAND.purpleLight, fontSize: 11 }}>Born from Family · Built for Community</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ color: BRAND.purpleLight, fontSize: 13, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase" }}>Travel Quote Builder</span>
          <button onClick={() => setShowPreview(true)} style={{
            background: BRAND.purpleMid, color: "#fff", border: "none",
            borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer"
          }}>Preview Quote →</button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: "28px 24px" }}>

        {/* Agent / Client / Config Row */}
        <div style={{ background: BRAND.white, borderRadius: 14, padding: "20px 24px", marginBottom: 20, border: `1.5px solid ${BRAND.gray200}` }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginBottom: 16 }}>
            <Field label="Agent / Specialist" half>
              <TextInput value={quote.agent} onChange={v => updateQ("agent", v)} placeholder="Your name" />
            </Field>
            <Field label="Client Name" half>
              <TextInput value={quote.client} onChange={v => updateQ("client", v)} placeholder="Client name" />
            </Field>
            <Field label="Trip Destination" half>
              <TextInput value={quote.destination} onChange={v => updateQ("destination", v)} placeholder="e.g. Cartagena, Colombia" />
            </Field>
            <Field label="Payment / Booking Link" half>
              <TextInput value={quote.bookLink} onChange={v => updateQ("bookLink", v)} placeholder="https://book.stripe.com/..." />
            </Field>
          </div>
          <Field label="Quote Notes / Special Terms">
            <TextInput value={quote.notes} onChange={v => updateQ("notes", v)} placeholder="Optional: payment terms, validity, special conditions..." />
          </Field>
        </div>

        {/* Markup Slider */}
        <div style={{
          background: BRAND.purple, borderRadius: 14, padding: "20px 28px",
          marginBottom: 20, display: "flex", alignItems: "center", gap: 24
        }}>
          <div style={{ flex: 1 }}>
            <div style={{ color: BRAND.purpleLight, fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>
              Profit Markup — your quote stays competitive below retail
            </div>
            <input type="range" min={0} max={30} step={0.5} value={markup}
              onChange={e => setMarkup(Number(e.target.value))}
              style={{ width: "100%", accentColor: BRAND.purpleLight, cursor: "pointer", height: 4 }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>0%</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>15%</span>
              <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 11 }}>30%</span>
            </div>
          </div>
          <div style={{ textAlign: "right", minWidth: 80 }}>
            <div style={{ color: "#fff", fontSize: 36, fontWeight: 800, lineHeight: 1 }}>{markup}%</div>
            <div style={{ color: BRAND.purpleLight, fontSize: 11, marginTop: 4 }}>markup</div>
          </div>
        </div>

        {/* Live Summary Bar */}
        <div style={{
          background: BRAND.white, border: `1.5px solid ${BRAND.gray200}`,
          borderRadius: 12, padding: "14px 24px", marginBottom: 24,
          display: "flex", gap: 0, flexWrap: "wrap"
        }}>
          {[
            { label: "Base Cost", value: fmt(totalBase), sub: "your cost" },
            { label: "Your Profit", value: fmt(profit), sub: `${markup}% markup`, highlight: true },
            { label: "Client Price", value: fmt(clientTotal), sub: "what client pays", big: true },
          ].map((item, i) => (
            <div key={i} style={{
              flex: 1, minWidth: 140, padding: "4px 20px",
              borderRight: i < 2 ? `1px solid ${BRAND.gray200}` : "none",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: item.highlight ? BRAND.green : BRAND.gray400, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>{item.label}</div>
              <div style={{ fontSize: item.big ? 22 : 18, fontWeight: 800, color: item.big ? BRAND.purple : BRAND.gray900 }}>{item.value}</div>
              <div style={{ fontSize: 11, color: BRAND.gray400 }}>{item.sub}</div>
            </div>
          ))}
        </div>

        {/* FLIGHTS */}
        <Section title="Flights" onAdd={() => setFlights(fs => [...fs, defaultFlight()])} addLabel="Add Flight">
          {flights.map((f, i) => (
            <CardWrap key={f.id} onRemove={flights.length > 1 ? () => removeFlight(f.id) : null}>
              <Field label="From" third>
                <TextInput value={f.from} onChange={v => updateFlight(f.id, "from", v)} placeholder="ATL" />
              </Field>
              <Field label="To" third>
                <TextInput value={f.to} onChange={v => updateFlight(f.id, "to", v)} placeholder="CTG" />
              </Field>
              <Field label="Airline" third>
                <TextInput value={f.airline} onChange={v => updateFlight(f.id, "airline", v)} placeholder="Avianca, Delta..." />
              </Field>
              <Field label="Depart Date" third>
                <TextInput type="date" value={f.date} onChange={v => updateFlight(f.id, "date", v)} />
              </Field>
              <Field label="Return Date (optional)" third>
                <TextInput type="date" value={f.returnDate} onChange={v => updateFlight(f.id, "returnDate", v)} />
              </Field>
              <Field label="Passengers" third>
                <TextInput type="number" value={f.passengers} onChange={v => updateFlight(f.id, "passengers", v)} placeholder="1" />
              </Field>
              <Field label="Cabin Class" half>
                <SelectInput value={f.cabin} onChange={v => updateFlight(f.id, "cabin", v)}
                  options={["Economy", "Premium Economy", "Business", "First Class"]} />
              </Field>
              <Field label="Base Price / Person ($)" half>
                <TextInput type="number" value={f.basePrice} onChange={v => updateFlight(f.id, "basePrice", v)} placeholder="0.00" />
              </Field>
              <Field label="Notes">
                <TextInput value={f.notes} onChange={v => updateFlight(f.id, "notes", v)} placeholder="Layover, baggage, special requests..." />
              </Field>
              <div style={{ flex: "1 1 100%", display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                <span style={{ fontSize: 12, color: BRAND.gray600 }}>
                  Client price: <strong>{fmt(Number(f.basePrice) * (1 + markup / 100))}</strong> /person ·{" "}
                  <strong>{fmt(Number(f.basePrice) * Number(f.passengers) * (1 + markup / 100))}</strong> total
                </span>
              </div>
            </CardWrap>
          ))}
        </Section>

        {/* HOTELS */}
        <Section title="Accommodations" onAdd={() => setHotels(hs => [...hs, defaultHotel()])} addLabel="Add Hotel / Villa" color={BRAND.green}>
          {hotels.map((h) => (
            <CardWrap key={h.id} onRemove={hotels.length > 1 ? () => removeHotel(h.id) : null}>
              <Field label="Property Name" half>
                <TextInput value={h.name} onChange={v => updateHotel(h.id, "name", v)} placeholder="Hilton, Villa name..." />
              </Field>
              <Field label="Location / Neighborhood" half>
                <TextInput value={h.location} onChange={v => updateHotel(h.id, "location", v)} placeholder="Bocagrande, Cartagena" />
              </Field>
              <Field label="Check-In" third>
                <TextInput type="date" value={h.checkIn} onChange={v => updateHotel(h.id, "checkIn", v)} />
              </Field>
              <Field label="Check-Out" third>
                <TextInput type="date" value={h.checkOut} onChange={v => updateHotel(h.id, "checkOut", v)} />
              </Field>
              <Field label="Nights" third>
                <TextInput type="number" value={h.nights} onChange={v => updateHotel(h.id, "nights", v)} placeholder="1" />
              </Field>
              <Field label="Room Type" third>
                <TextInput value={h.roomType} onChange={v => updateHotel(h.id, "roomType", v)} placeholder="3BR/3BA Villa, Suite..." />
              </Field>
              <Field label="Bed Type" third>
                <TextInput value={h.beds} onChange={v => updateHotel(h.id, "beds", v)} placeholder="3 King Beds" />
              </Field>
              <Field label="Guests" third>
                <TextInput type="number" value={h.guests} onChange={v => updateHotel(h.id, "guests", v)} placeholder="2" />
              </Field>
              <Field label="Base Price / Night ($)" half>
                <TextInput type="number" value={h.basePrice} onChange={v => updateHotel(h.id, "basePrice", v)} placeholder="0.00" />
              </Field>
              <Field label="Notes" half>
                <TextInput value={h.notes} onChange={v => updateHotel(h.id, "notes", v)} placeholder="Beachfront, pool, breakfast included..." />
              </Field>
              <div style={{ flex: "1 1 100%", display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                <span style={{ fontSize: 12, color: BRAND.gray600 }}>
                  Client price: <strong>{fmt(Number(h.basePrice) * (1 + markup / 100))}</strong>/night ·{" "}
                  <strong>{fmt(Number(h.basePrice) * h.nights * (1 + markup / 100))}</strong> total
                </span>
              </div>
            </CardWrap>
          ))}
        </Section>

        {/* EXTRAS */}
        <Section title="Additional Services" onAdd={() => setExtras(es => [...es, defaultExtra()])} addLabel="Add Service" color={BRAND.gold}>
          {extras.map((e) => (
            <CardWrap key={e.id} onRemove={extras.length > 1 ? () => removeExtra(e.id) : null}>
              <Field label="Description" half>
                <TextInput value={e.description} onChange={v => updateExtra(e.id, "description", v)} placeholder="Airport transfer, tour, car rental..." />
              </Field>
              <Field label="Qty" third style={{ maxWidth: 80 }}>
                <TextInput type="number" value={e.quantity} onChange={v => updateExtra(e.id, "quantity", v)} placeholder="1" />
              </Field>
              <Field label="Base Price ($)" third>
                <TextInput type="number" value={e.basePrice} onChange={v => updateExtra(e.id, "basePrice", v)} placeholder="0.00" />
              </Field>
              <Field label="Notes">
                <TextInput value={e.notes} onChange={v => updateExtra(e.id, "notes", v)} placeholder="Details..." />
              </Field>
              <div style={{ flex: "1 1 100%", display: "flex", justifyContent: "flex-end", paddingTop: 4 }}>
                <span style={{ fontSize: 12, color: BRAND.gray600 }}>
                  Client price: <strong>{fmt(Number(e.basePrice) * e.quantity * (1 + markup / 100))}</strong> total
                </span>
              </div>
            </CardWrap>
          ))}
        </Section>

        {/* Preview Button */}
        <div style={{ textAlign: "center", paddingTop: 8, paddingBottom: 32 }}>
          <button onClick={() => setShowPreview(true)} style={{
            background: BRAND.purple, color: "#fff", border: "none",
            borderRadius: 12, padding: "14px 40px", fontSize: 16, fontWeight: 700,
            cursor: "pointer", letterSpacing: "0.02em"
          }}>
            Preview & Print Quote →
          </button>
        </div>
      </div>

      {showPreview && (
        <QuotePreview
          quote={quote} markup={markup}
          flights={flights} hotels={hotels} extras={extras}
          total={totalBase} clientTotal={clientTotal}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
