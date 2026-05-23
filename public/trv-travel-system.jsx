import { useState, useRef } from "react";

const uid = () => Math.random().toString(36).slice(2, 8);
const fmtMoney = (n) => n ? `$${Number(n).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}` : "—";
const today = () => new Date().toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"});

const TOS_TEXT = `TERMS OF SERVICE — THE REAL VACATIONS

1. BOOKING & DEPOSITS
Reservations require a deposit to secure your spot. Deposits are non-refundable after 24 hours but are transferable to another traveler with a $50 fee. Full payment is due on the date specified in your trip details.

2. CANCELLATION POLICY
Cancellations within 24 hours of booking: full refund. After 24 hours: deposit forfeited, balance refundable up to 30 days before departure. Within 30 days of departure: no refund unless travel insurance applies.

3. TRAVEL INSURANCE
Travel insurance is strongly recommended. The Real Vacations is not liable for losses due to flight cancellations, medical emergencies, weather, or acts of God. We can help you secure a policy.

4. AGENT SERVICES & FEES
Quote prices include a service fee for research, coordination, and 24/7 trip support. Pricing is competitive and often below retail rates. Service fees are non-refundable.

5. ACCURACY OF INFORMATION
Client is responsible for ensuring all traveler names, passport information, and dates are accurate at the time of booking. Changes after ticketing may incur fees from airlines or hotels.

6. CORPORATE ACCOUNTS
Corporate clients agree to a 48-hour quote acceptance window. Rates are held for that window only. Volume bookings may qualify for additional discounts.

7. PRIVACY
Your personal and payment information is used solely to process bookings and provide travel services. We do not sell or share your information.

8. GOVERNING LAW
These terms are governed by the laws of the State of Georgia, USA.

By submitting a trip request or accepting a quote, you agree to these terms.`;

const INIT_REQUESTS = [
  {id:"r1", name:"Kaci Johnson", email:"kaci@email.com", phone:"404-555-0101",
   type:"Full Trip", from:"ATL / TPA", to:"Cartagena, Colombia (CTG)",
   depart:"2026-06-05", return:"2026-06-10", passengers:3,
   cabin:"Economy", hotelType:"3BR/3BA Beachfront Villa", bedPref:"Kings (all 3)",
   budget:"$5,000–$8,000", notes:"2 pax from ATL, 1 pax from TPA. Need beachfront.",
   status:"new", submitted:today()}
];

const defaultFlight = () => ({id:uid(),from:"",to:"",depart:"",returnDate:"",pax:1,cabin:"Economy",airline:"",price:""});
const defaultHotel  = () => ({id:uid(),name:"",location:"",checkIn:"",checkOut:"",nights:1,room:"",beds:"",guests:2,price:"",notes:""});
const defaultExtra  = () => ({id:uid(),desc:"",qty:1,price:""});

// ─────────────────────── shared atoms ────────────────────────────────────────

const iStyle = {
  width:"100%",padding:"8px 11px",border:"0.5px solid var(--color-border-secondary)",
  borderRadius:"var(--border-radius-md)",fontSize:14,color:"var(--color-text-primary)",
  background:"var(--color-background-primary)",boxSizing:"border-box",fontFamily:"inherit",
  outline:"none"
};

function F({label,half,third,children}) {
  return (
    <div style={{flex:third?"1 1 30%":half?"1 1 45%":"1 1 100%",minWidth:third?130:half?160:"100%",display:"flex",flexDirection:"column",gap:4}}>
      {label && <label style={{fontSize:11,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.06em"}}>{label}</label>}
      {children}
    </div>
  );
}

function In({value,onChange,placeholder,type="text",rows}) {
  if(rows) return <textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} rows={rows} style={{...iStyle,resize:"vertical"}} />;
  return <input type={type} value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder} style={iStyle} />;
}

function Sel({value,onChange,options}) {
  return (
    <select value={value} onChange={e=>onChange(e.target.value)} style={iStyle}>
      {options.map(o=><option key={o.value||o} value={o.value||o}>{o.label||o}</option>)}
    </select>
  );
}

function Card({children,style}) {
  return <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",padding:"1rem 1.25rem",...style}}>{children}</div>;
}

function Badge({color,children}) {
  const map = {
    new:{bg:"var(--color-background-info)",color:"var(--color-text-info)"},
    sent:{bg:"var(--color-background-success)",color:"var(--color-text-success)"},
    pending:{bg:"var(--color-background-warning)",color:"var(--color-text-warning)"},
    accepted:{bg:"var(--color-background-success)",color:"var(--color-text-success)"},
  };
  const s = map[color]||map.new;
  return <span style={{fontSize:11,fontWeight:500,padding:"3px 10px",borderRadius:"var(--border-radius-md)",background:s.bg,color:s.color}}>{children}</span>;
}

function Btn({onClick,children,variant="default",style}) {
  const variants = {
    default:{background:"var(--color-background-primary)",color:"var(--color-text-primary)",border:"0.5px solid var(--color-border-secondary)"},
    primary:{background:"#3b0764",color:"#fff",border:"none"},
    ghost:{background:"transparent",color:"var(--color-text-secondary)",border:"none"},
    danger:{background:"var(--color-background-danger)",color:"var(--color-text-danger)",border:"none"},
  };
  return (
    <button onClick={onClick} style={{padding:"8px 16px",borderRadius:"var(--border-radius-md)",fontSize:13,fontWeight:500,cursor:"pointer",fontFamily:"inherit",...variants[variant],...style}}>
      {children}
    </button>
  );
}

// ─────────────────────── SEND MODAL ──────────────────────────────────────────

function SendModal({quote,flights,hotels,extras,markup,clientTotal,onClose,onSent}) {
  const [toEmail,setToEmail] = useState(quote.clientEmail||"");
  const [copied,setCopied] = useState(false);

  const profit = clientTotal - (flights.reduce((s,f)=>s+(+f.price||0)*(+f.pax||1),0)+hotels.reduce((s,h)=>s+(+h.price||0)*(+h.nights||1),0)+extras.reduce((s,e)=>s+(+e.price||0)*(+e.qty||1),0));

  const quoteText = () => {
    let t = `TRAVEL QUOTE — THE REAL VACATIONS\nPrepared for: ${quote.client||"Valued Client"}\nDate: ${today()}\nAgent: ${quote.agent||"The Real Vacations Team"}\n\n`;
    if(flights.length) {
      t += `✈ FLIGHTS\n`;
      flights.forEach(f=>{ if(f.from||f.to) t += `  ${f.from||"?"} → ${f.to||"?"} | ${f.depart||"TBD"}${f.returnDate?` – ${f.returnDate}`:""} | ${f.pax} pax | ${f.cabin}${f.airline?` | ${f.airline}`:""} | ${fmtMoney(+f.price*(1+markup/100))}/person\n`; });
    }
    if(hotels.length) {
      t += `\n🏨 ACCOMMODATIONS\n`;
      hotels.forEach(h=>{ if(h.name) t += `  ${h.name}${h.location?`, ${h.location}`:""} | ${h.checkIn||"TBD"} – ${h.checkOut||"TBD"} | ${h.nights} nights | ${h.room||""}${h.beds?` | ${h.beds}`:""} | ${fmtMoney(+h.price*(1+markup/100)*h.nights)} total\n`; });
    }
    if(extras.some(e=>e.desc)) {
      t += `\n🎟 ADDITIONAL SERVICES\n`;
      extras.filter(e=>e.desc).forEach(e=>{ t += `  ${e.desc} × ${e.qty} | ${fmtMoney(+e.price*(1+markup/100)*e.qty)}\n`; });
    }
    t += `\n━━━━━━━━━━━━━━━━━━━━━━━━\nTOTAL: ${fmtMoney(clientTotal)}\n━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    if(quote.bookLink) t += `\n📌 BOOK HERE: ${quote.bookLink}\n`;
    t += `\nQuote valid 48 hours · therealvacations.com · 404-923-0017`;
    return t;
  };

  const handleCopy = () => { navigator.clipboard?.writeText(quoteText()); setCopied(true); setTimeout(()=>setCopied(false),2500); };
  const handleEmail = () => {
    const sub = encodeURIComponent(`Your Travel Quote — ${quote.client||"Trip"} to ${quote.destination||"Your Destination"}`);
    const body = encodeURIComponent(`Hi ${quote.client||"there"},\n\nHere is your personalized travel quote:\n\n${quoteText()}\n\nReady to book? Let me know any questions!\n\nKevia\nThe Real Vacations\n404-923-0017`);
    window.location.href = `mailto:${toEmail}?subject=${sub}&body=${body}`;
  };
  const handleWA = () => {
    const msg = encodeURIComponent(`Hi ${quote.client||"there"}! Here's your travel quote from The Real Vacations:\n\n${quoteText()}`);
    window.open(`https://wa.me/?text=${msg}`,"_blank");
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",zIndex:100,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
      <Card style={{width:"100%",maxWidth:560,maxHeight:"90vh",overflow:"auto"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
          <h3 style={{margin:0,fontSize:16,fontWeight:500}}><i className="ti ti-send" aria-hidden="true" style={{marginRight:8}}/>Send Quote to Client</h3>
          <Btn variant="ghost" onClick={onClose}><i className="ti ti-x"/></Btn>
        </div>

        <div style={{display:"flex",flexWrap:"wrap",gap:12,marginBottom:16}}>
          <F label="Client email" half><In value={toEmail} onChange={setToEmail} placeholder="client@email.com" type="email"/></F>
          <F label="Total" half>
            <div style={{padding:"8px 12px",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",fontSize:18,fontWeight:500}}>{fmtMoney(clientTotal)}</div>
          </F>
        </div>

        <div style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:12,fontSize:12,fontFamily:"var(--font-mono)",whiteSpace:"pre-wrap",maxHeight:220,overflow:"auto",marginBottom:16,color:"var(--color-text-secondary)",lineHeight:1.6}}>
          {quoteText()}
        </div>

        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
          <Btn variant="primary" onClick={handleEmail}><i className="ti ti-mail" aria-hidden="true" style={{marginRight:6}}/>Open in email</Btn>
          <Btn onClick={handleCopy}>{copied ? <><i className="ti ti-check" aria-hidden="true" style={{marginRight:6}}/>Copied!</> : <><i className="ti ti-clipboard" aria-hidden="true" style={{marginRight:6}}/>Copy quote text</>}</Btn>
          <Btn onClick={handleWA}><i className="ti ti-brand-whatsapp" aria-hidden="true" style={{marginRight:6}}/>WhatsApp</Btn>
        </div>

        <Btn variant="primary" onClick={()=>{onSent();onClose();}} style={{width:"100%",textAlign:"center"}}>
          <i className="ti ti-check" aria-hidden="true" style={{marginRight:6}}/>Mark as sent
        </Btn>
      </Card>
    </div>
  );
}

// ─────────────────────── QUOTE BUILDER ───────────────────────────────────────

function QuoteBuilder({prefill, onSent, allClients}) {
  const [q,setQ] = useState({agent:"Kevia",client:prefill?.name||"",clientEmail:prefill?.email||"",destination:prefill?.to||"",bookLink:"",notes:""});
  const [markup,setMarkup] = useState(17);
  const [flights,setFlights] = useState([{...defaultFlight(),from:prefill?.from||"",to:prefill?.to||"",depart:prefill?.depart||"",returnDate:prefill?.return||"",pax:prefill?.passengers||1}]);
  const [hotels,setHotels] = useState([{...defaultHotel(),room:prefill?.hotelType||"",beds:prefill?.bedPref||""}]);
  const [extras,setExtras] = useState([defaultExtra()]);
  const [showSend,setShowSend] = useState(false);

  const uq = (k,v) => setQ(x=>({...x,[k]:v}));
  const uf = (id,k,v) => setFlights(fs=>fs.map(f=>f.id===id?{...f,[k]:v}:f));
  const uh = (id,k,v) => setHotels(hs=>hs.map(h=>h.id===id?{...h,[k]:v}:h));
  const ue = (id,k,v) => setExtras(es=>es.map(e=>e.id===id?{...e,[k]:v}:e));

  const flightBase = flights.reduce((s,f)=>s+(+f.price||0)*(+f.pax||1),0);
  const hotelBase  = hotels.reduce((s,h)=>s+(+h.price||0)*(+h.nights||1),0);
  const extrasBase = extras.reduce((s,e)=>s+(+e.price||0)*(+e.qty||1),0);
  const base = flightBase+hotelBase+extrasBase;
  const clientTotal = base*(1+markup/100);
  const profit = clientTotal-base;

  const SectionHdr = ({title,onAdd,addLabel}) => (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12,marginTop:24}}>
      <p style={{margin:0,fontSize:13,fontWeight:500,color:"var(--color-text-secondary)",textTransform:"uppercase",letterSpacing:"0.07em"}}>{title}</p>
      {onAdd && <Btn onClick={onAdd} style={{fontSize:12,padding:"5px 12px"}}>+ {addLabel}</Btn>}
    </div>
  );

  const ItemCard = ({children,onRemove}) => (
    <div style={{border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-md)",padding:14,marginBottom:10,position:"relative"}}>
      {onRemove && <button onClick={onRemove} style={{position:"absolute",top:8,right:10,background:"none",border:"none",color:"var(--color-text-secondary)",cursor:"pointer",fontSize:16}}>×</button>}
      <div style={{display:"flex",flexWrap:"wrap",gap:10}}>{children}</div>
    </div>
  );

  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 20px"}}>Quote builder</h2>

      {/* Header info */}
      <Card style={{marginBottom:16}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <F label="Agent" half><In value={q.agent} onChange={v=>uq("agent",v)} placeholder="Agent name"/></F>
          <F label="Client name" half>
            <div style={{display:"flex",gap:6}}>
              <In value={q.client} onChange={v=>uq("client",v)} placeholder="Client name"/>
            </div>
          </F>
          <F label="Client email" half><In value={q.clientEmail} onChange={v=>uq("clientEmail",v)} placeholder="client@email.com" type="email"/></F>
          <F label="Destination" half><In value={q.destination} onChange={v=>uq("destination",v)} placeholder="e.g. Cartagena, Colombia"/></F>
          <F label="Booking/payment link"><In value={q.bookLink} onChange={v=>uq("bookLink",v)} placeholder="https://book.stripe.com/..."/></F>
          <F label="Quote notes"><In value={q.notes} onChange={v=>uq("notes",v)} placeholder="Payment terms, validity, special conditions..."/></F>
        </div>
      </Card>

      {/* Markup */}
      <div style={{background:"#3b0764",borderRadius:"var(--border-radius-lg)",padding:"16px 20px",marginBottom:16,display:"flex",gap:20,alignItems:"center"}}>
        <div style={{flex:1}}>
          <p style={{margin:"0 0 8px",fontSize:12,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:"0.07em"}}>Profit markup</p>
          <input type="range" min={0} max={30} step={0.5} value={markup} onChange={e=>setMarkup(+e.target.value)} style={{width:"100%",accentColor:"#c4b5fd"}}/>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:11,color:"rgba(255,255,255,0.35)",marginTop:4}}>
            <span>0%</span><span>15%</span><span>30%</span>
          </div>
        </div>
        <div style={{textAlign:"right",minWidth:70}}>
          <div style={{color:"#fff",fontSize:32,fontWeight:500}}>{markup}%</div>
          <div style={{color:"rgba(255,255,255,0.5)",fontSize:11}}>markup</div>
        </div>
      </div>

      {/* Live summary */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginBottom:20}}>
        {[["Your cost",fmtMoney(base),""],["Your profit",fmtMoney(profit),"success"],["Client total",fmtMoney(clientTotal),"info"]].map(([lbl,val,s])=>(
          <div key={lbl} style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 16px"}}>
            <p style={{margin:"0 0 4px",fontSize:11,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:s?`var(--color-text-${s})`:"var(--color-text-secondary)"}}>{lbl}</p>
            <p style={{margin:0,fontSize:20,fontWeight:500,color:s?`var(--color-text-${s})`:"var(--color-text-primary)"}}>{val}</p>
          </div>
        ))}
      </div>

      {/* Flights */}
      <SectionHdr title="Flights" onAdd={()=>setFlights(fs=>[...fs,defaultFlight()])} addLabel="Add flight"/>
      {flights.map(f=>(
        <ItemCard key={f.id} onRemove={flights.length>1?()=>setFlights(fs=>fs.filter(x=>x.id!==f.id)):null}>
          <F label="From" third><In value={f.from} onChange={v=>uf(f.id,"from",v)} placeholder="ATL"/></F>
          <F label="To" third><In value={f.to} onChange={v=>uf(f.id,"to",v)} placeholder="CTG"/></F>
          <F label="Airline" third><In value={f.airline} onChange={v=>uf(f.id,"airline",v)} placeholder="Avianca..."/></F>
          <F label="Depart" third><In type="date" value={f.depart} onChange={v=>uf(f.id,"depart",v)}/></F>
          <F label="Return (opt)" third><In type="date" value={f.returnDate} onChange={v=>uf(f.id,"returnDate",v)}/></F>
          <F label="Pax" third><In type="number" value={f.pax} onChange={v=>uf(f.id,"pax",v)} placeholder="1"/></F>
          <F label="Cabin" half><Sel value={f.cabin} onChange={v=>uf(f.id,"cabin",v)} options={["Economy","Premium Economy","Business","First Class"]}/></F>
          <F label="Base price / person ($)" half><In type="number" value={f.price} onChange={v=>uf(f.id,"price",v)} placeholder="0.00"/></F>
          <div style={{flex:"1 1 100%",textAlign:"right",fontSize:12,color:"var(--color-text-secondary)",paddingTop:2}}>
            Client: {fmtMoney((+f.price)*(1+markup/100))}/person · {fmtMoney((+f.price)*(+f.pax)*(1+markup/100))} total
          </div>
        </ItemCard>
      ))}

      {/* Hotels */}
      <SectionHdr title="Accommodations" onAdd={()=>setHotels(hs=>[...hs,defaultHotel()])} addLabel="Add hotel / villa"/>
      {hotels.map(h=>(
        <ItemCard key={h.id} onRemove={hotels.length>1?()=>setHotels(hs=>hs.filter(x=>x.id!==h.id)):null}>
          <F label="Property name" half><In value={h.name} onChange={v=>uh(h.id,"name",v)} placeholder="Villa, hotel name..."/></F>
          <F label="Location" half><In value={h.location} onChange={v=>uh(h.id,"location",v)} placeholder="Bocagrande, Cartagena"/></F>
          <F label="Check-in" third><In type="date" value={h.checkIn} onChange={v=>uh(h.id,"checkIn",v)}/></F>
          <F label="Check-out" third><In type="date" value={h.checkOut} onChange={v=>uh(h.id,"checkOut",v)}/></F>
          <F label="Nights" third><In type="number" value={h.nights} onChange={v=>uh(h.id,"nights",v)} placeholder="1"/></F>
          <F label="Room type" third><In value={h.room} onChange={v=>uh(h.id,"room",v)} placeholder="3BR/3BA Villa, Suite..."/></F>
          <F label="Beds" third><In value={h.beds} onChange={v=>uh(h.id,"beds",v)} placeholder="3 King beds"/></F>
          <F label="Guests" third><In type="number" value={h.guests} onChange={v=>uh(h.id,"guests",v)} placeholder="2"/></F>
          <F label="Base price / night ($)" half><In type="number" value={h.price} onChange={v=>uh(h.id,"price",v)} placeholder="0.00"/></F>
          <F label="Notes" half><In value={h.notes} onChange={v=>uh(h.id,"notes",v)} placeholder="Beachfront, pool, breakfast..."/></F>
          <div style={{flex:"1 1 100%",textAlign:"right",fontSize:12,color:"var(--color-text-secondary)",paddingTop:2}}>
            Client: {fmtMoney((+h.price)*(1+markup/100))}/night · {fmtMoney((+h.price)*h.nights*(1+markup/100))} total
          </div>
        </ItemCard>
      ))}

      {/* Extras */}
      <SectionHdr title="Additional services" onAdd={()=>setExtras(es=>[...es,defaultExtra()])} addLabel="Add service"/>
      {extras.map(e=>(
        <ItemCard key={e.id} onRemove={extras.length>1?()=>setExtras(es=>es.filter(x=>x.id!==e.id)):null}>
          <F label="Description" half><In value={e.desc} onChange={v=>ue(e.id,"desc",v)} placeholder="Transfer, tour, car rental..."/></F>
          <F label="Qty" third><In type="number" value={e.qty} onChange={v=>ue(e.id,"qty",v)} placeholder="1"/></F>
          <F label="Base price ($)" third><In type="number" value={e.price} onChange={v=>ue(e.id,"price",v)} placeholder="0.00"/></F>
          <div style={{flex:"1 1 100%",textAlign:"right",fontSize:12,color:"var(--color-text-secondary)",paddingTop:2}}>
            Client: {fmtMoney((+e.price)*(+e.qty)*(1+markup/100))} total
          </div>
        </ItemCard>
      ))}

      <div style={{display:"flex",gap:10,marginTop:24,paddingBottom:40}}>
        <Btn variant="primary" onClick={()=>setShowSend(true)} style={{flex:1,textAlign:"center",padding:"11px 20px",fontSize:14}}>
          <i className="ti ti-send" aria-hidden="true" style={{marginRight:8}}/>Send quote to client
        </Btn>
      </div>

      {showSend && (
        <SendModal
          quote={q} flights={flights} hotels={hotels} extras={extras}
          markup={markup} clientTotal={clientTotal}
          onClose={()=>setShowSend(false)}
          onSent={()=>onSent&&onSent({...q,clientTotal,markup,flights,hotels,extras,id:uid(),status:"sent",date:today()})}
        />
      )}
    </div>
  );
}

// ─────────────────────── AGENT: REQUESTS ─────────────────────────────────────

function RequestsView({requests,onBuildQuote}) {
  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 20px"}}>Trip requests</h2>
      {requests.length===0 && (
        <Card><p style={{color:"var(--color-text-secondary)",textAlign:"center",padding:32}}>No requests yet. Share your client portal link to start receiving requests.</p></Card>
      )}
      {requests.map(r=>(
        <Card key={r.id} style={{marginBottom:12}}>
          <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",gap:12,flexWrap:"wrap"}}>
            <div style={{flex:1}}>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:8}}>
                <div style={{width:38,height:38,borderRadius:"50%",background:"var(--color-background-info)",display:"flex",alignItems:"center",justifyContent:"center",fontWeight:500,fontSize:14,color:"var(--color-text-info)"}}>
                  {r.name.split(" ").map(n=>n[0]).join("").slice(0,2)}
                </div>
                <div>
                  <p style={{margin:0,fontWeight:500,fontSize:15}}>{r.name}</p>
                  <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>{r.email} · {r.phone}</p>
                </div>
                <Badge color={r.status}>{r.status}</Badge>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))",gap:"6px 20px",fontSize:13}}>
                <div><span style={{color:"var(--color-text-secondary)"}}>Route: </span>{r.from} → {r.to}</div>
                <div><span style={{color:"var(--color-text-secondary)"}}>Dates: </span>{r.depart} – {r.return}</div>
                <div><span style={{color:"var(--color-text-secondary)"}}>Travelers: </span>{r.passengers} pax</div>
                <div><span style={{color:"var(--color-text-secondary)"}}>Type: </span>{r.type}</div>
                {r.hotelType && <div><span style={{color:"var(--color-text-secondary)"}}>Hotel: </span>{r.hotelType}</div>}
                {r.bedPref && <div><span style={{color:"var(--color-text-secondary)"}}>Beds: </span>{r.bedPref}</div>}
                {r.budget && <div><span style={{color:"var(--color-text-secondary)"}}>Budget: </span>{r.budget}</div>}
                {r.cabin && <div><span style={{color:"var(--color-text-secondary)"}}>Cabin: </span>{r.cabin}</div>}
              </div>
              {r.notes && <p style={{margin:"8px 0 0",fontSize:12,color:"var(--color-text-secondary)",background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"6px 10px"}}>{r.notes}</p>}
              <p style={{margin:"8px 0 0",fontSize:11,color:"var(--color-text-secondary)"}}>Submitted {r.submitted}</p>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:8,minWidth:130}}>
              <Btn variant="primary" onClick={()=>onBuildQuote(r)}>
                <i className="ti ti-file-invoice" aria-hidden="true" style={{marginRight:6}}/>Build quote
              </Btn>
              <Btn variant="ghost" style={{fontSize:12,color:"var(--color-text-secondary)"}}>
                <i className="ti ti-message" aria-hidden="true" style={{marginRight:6}}/>Contact client
              </Btn>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────── AGENT: SENT QUOTES ──────────────────────────────────

function SentQuotesView({quotes}) {
  return (
    <div style={{maxWidth:860,margin:"0 auto"}}>
      <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 20px"}}>Sent quotes</h2>
      {quotes.length===0 && <Card><p style={{color:"var(--color-text-secondary)",textAlign:"center",padding:32}}>No quotes sent yet. Build and send your first quote.</p></Card>}
      {quotes.map(q=>(
        <Card key={q.id} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8}}>
            <div>
              <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:4}}>
                <p style={{margin:0,fontWeight:500}}>{q.client||"Client"}</p>
                <Badge color={q.status}>{q.status}</Badge>
              </div>
              <p style={{margin:0,fontSize:13,color:"var(--color-text-secondary)"}}>{q.destination||"Trip"} · Sent {q.date}</p>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{margin:0,fontSize:20,fontWeight:500}}>{fmtMoney(q.clientTotal)}</p>
              <p style={{margin:0,fontSize:11,color:"var(--color-text-secondary)"}}>{q.markup}% markup</p>
            </div>
          </div>
        </Card>
      ))}
    </div>
  );
}

// ─────────────────────── CLIENT: TRIP REQUEST WIZARD ─────────────────────────

const TRIP_TYPES = [
  {id:"full",icon:"ti-package",label:"Full trip",sub:"Flights + hotel + extras"},
  {id:"flights",icon:"ti-plane",label:"Flights only",sub:"Just need the flights"},
  {id:"hotel",icon:"ti-building",label:"Hotel / villa",sub:"Accommodation only"},
  {id:"corporate",icon:"ti-briefcase",label:"Corporate / VIP",sub:"Business or group travel"},
];

function TripRequestWizard({onSubmit}) {
  const [step,setStep] = useState(1);
  const [info,setInfo] = useState({name:"",email:"",phone:""});
  const [type,setType] = useState("");
  const [details,setDetails] = useState({
    from:"",to:"",depart:"",return:"",passengers:1,cabin:"Economy",
    hotelType:"",bedPref:"",guests:2,checkIn:"",checkOut:"",
    budget:"",notes:""
  });
  const [submitted,setSubmitted] = useState(false);

  const ui = (k,v) => setInfo(x=>({...x,[k]:v}));
  const ud = (k,v) => setDetails(x=>({...x,[k]:v}));

  const canNext1 = info.name&&info.email&&info.phone;
  const canNext2 = type!=="";

  const handleSubmit = () => {
    onSubmit({id:uid(),status:"new",submitted:today(),...info,...details,type:TRIP_TYPES.find(t=>t.id===type)?.label||type});
    setSubmitted(true);
  };

  if(submitted) return (
    <div style={{maxWidth:480,margin:"80px auto",textAlign:"center",padding:24}}>
      <div style={{width:64,height:64,background:"var(--color-background-success)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:28,color:"var(--color-text-success)"}}>
        <i className="ti ti-check" aria-hidden="true"/>
      </div>
      <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 8px"}}>Request received!</h2>
      <p style={{color:"var(--color-text-secondary)",marginBottom:24}}>We'll have your personalized quote ready within a few hours. Check your email at <strong>{info.email}</strong>.</p>
      <p style={{fontSize:13,color:"var(--color-text-secondary)"}}>Questions? Call us at <strong>404-923-0017</strong></p>
    </div>
  );

  return (
    <div style={{maxWidth:520,margin:"0 auto",padding:"24px 0 60px"}}>
      {/* Progress */}
      <div style={{display:"flex",gap:6,marginBottom:28}}>
        {[1,2,3].map(i=>(
          <div key={i} style={{flex:1,height:4,borderRadius:2,background:i<=step?"#3b0764":"var(--color-background-secondary)"}}/>
        ))}
      </div>

      {step===1 && (
        <div>
          <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 6px"}}>Let's plan your trip</h2>
          <p style={{color:"var(--color-text-secondary)",marginBottom:24}}>Tell us a little about yourself and we'll get you a personalized quote.</p>
          <Card>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              <F label="Your full name"><In value={info.name} onChange={v=>ui("name",v)} placeholder="First and last name"/></F>
              <F label="Email address"><In type="email" value={info.email} onChange={v=>ui("email",v)} placeholder="your@email.com"/></F>
              <F label="Phone number"><In type="tel" value={info.phone} onChange={v=>ui("phone",v)} placeholder="(404) 555-0100"/></F>
            </div>
          </Card>
          <Btn variant="primary" onClick={()=>canNext1&&setStep(2)} style={{width:"100%",marginTop:16,padding:"12px 20px",fontSize:14,textAlign:"center",opacity:canNext1?1:0.5}}>
            Continue <i className="ti ti-arrow-right" aria-hidden="true" style={{marginLeft:6}}/>
          </Btn>
        </div>
      )}

      {step===2 && (
        <div>
          <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 6px"}}>What do you need?</h2>
          <p style={{color:"var(--color-text-secondary)",marginBottom:20}}>Pick the type of trip you're planning.</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            {TRIP_TYPES.map(t=>(
              <button key={t.id} onClick={()=>setType(t.id)} style={{
                padding:"16px 14px",border:`2px solid ${type===t.id?"#3b0764":"var(--color-border-tertiary)"}`,
                borderRadius:"var(--border-radius-lg)",background:type===t.id?"#f5f3ff":"var(--color-background-primary)",
                cursor:"pointer",textAlign:"left",fontFamily:"inherit"
              }}>
                <i className={`ti ${t.icon}`} aria-hidden="true" style={{fontSize:22,color:type===t.id?"#3b0764":"var(--color-text-secondary)",display:"block",marginBottom:8}}/>
                <p style={{margin:"0 0 3px",fontSize:14,fontWeight:500,color:"var(--color-text-primary)"}}>{t.label}</p>
                <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>{t.sub}</p>
              </button>
            ))}
          </div>
          <div style={{display:"flex",gap:10}}>
            <Btn onClick={()=>setStep(1)}>Back</Btn>
            <Btn variant="primary" onClick={()=>canNext2&&setStep(3)} style={{flex:1,textAlign:"center",padding:"12px 20px",fontSize:14,opacity:canNext2?1:0.5}}>
              Continue <i className="ti ti-arrow-right" aria-hidden="true" style={{marginLeft:6}}/>
            </Btn>
          </div>
        </div>
      )}

      {step===3 && (
        <div>
          <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 6px"}}>Trip details</h2>
          <p style={{color:"var(--color-text-secondary)",marginBottom:20}}>The more detail the better — we'll handle the rest.</p>
          <Card>
            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {(type==="full"||type==="flights"||type==="corporate") && <>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  <F label="Flying from" half><In value={details.from} onChange={v=>ud("from",v)} placeholder="ATL, TPA..."/></F>
                  <F label="Flying to" half><In value={details.to} onChange={v=>ud("to",v)} placeholder="CTG, MIA..."/></F>
                  <F label="Depart" half><In type="date" value={details.depart} onChange={v=>ud("depart",v)}/></F>
                  <F label="Return" half><In type="date" value={details.return} onChange={v=>ud("return",v)}/></F>
                  <F label="Travelers" half><In type="number" value={details.passengers} onChange={v=>ud("passengers",v)} placeholder="1"/></F>
                  <F label="Cabin class" half>
                    <Sel value={details.cabin} onChange={v=>ud("cabin",v)} options={["Economy","Premium Economy","Business","First Class"]}/>
                  </F>
                </>
              </F>}
              {(type==="full"||type==="hotel"||type==="corporate") && <>
                <F label="Accommodation type"><In value={details.hotelType} onChange={v=>ud("hotelType",v)} placeholder="3BR villa, hotel room, suite..."/></F>
                <F label="Bed preference"><In value={details.bedPref} onChange={v=>ud("bedPref",v)} placeholder="Kings, queens, twin..."/></F>
                <div style={{display:"flex",gap:10}}>
                  <F label="Check-in" half><In type="date" value={details.checkIn} onChange={v=>ud("checkIn",v)}/></F>
                  <F label="Check-out" half><In type="date" value={details.checkOut} onChange={v=>ud("checkOut",v)}/></F>
                </div>
              </>}
              <F label="Budget (optional)"><In value={details.budget} onChange={v=>ud("budget",v)} placeholder="$3,000–$5,000 total..."/></F>
              <F label="Special requests or notes"><In value={details.notes} onChange={v=>ud("notes",v)} placeholder="Multiple departure cities, VIP needs, dietary, accessibility..." rows={3}/></F>
            </div>
          </Card>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <Btn onClick={()=>setStep(2)}>Back</Btn>
            <Btn variant="primary" onClick={handleSubmit} style={{flex:1,textAlign:"center",padding:"12px 20px",fontSize:14}}>
              <i className="ti ti-send" aria-hidden="true" style={{marginRight:6}}/>Submit request
            </Btn>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────── CLIENT: PROFILE + TOS ───────────────────────────────

function ClientProfileView() {
  const [p,setP] = useState({firstName:"",lastName:"",email:"",phone:"",dob:"",passport:"",passportExp:"",nationality:"",emergency:"",emergencyPhone:"",seat:"Window",meal:"No preference",hotel:"King bed",tosRead:false,tosAccepted:false});
  const [saved,setSaved] = useState(false);
  const tosRef = useRef();
  const up = (k,v) => setP(x=>({...x,[k]:v}));

  const handleTosScroll = () => {
    const el = tosRef.current;
    if(el && el.scrollTop+el.clientHeight>=el.scrollHeight-20) up("tosRead",true);
  };

  const canSave = p.firstName&&p.lastName&&p.email&&p.phone&&p.tosAccepted;

  if(saved) return (
    <div style={{maxWidth:480,margin:"80px auto",textAlign:"center",padding:24}}>
      <div style={{width:64,height:64,background:"var(--color-background-success)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",margin:"0 auto 20px",fontSize:28,color:"var(--color-text-success)"}}>
        <i className="ti ti-check" aria-hidden="true"/>
      </div>
      <h2 style={{fontSize:22,fontWeight:500,margin:"0 0 8px"}}>Profile saved!</h2>
      <p style={{color:"var(--color-text-secondary)"}}>Your profile is set up. Future bookings will be faster since your info is on file.</p>
    </div>
  );

  return (
    <div style={{maxWidth:580,margin:"0 auto",padding:"0 0 60px"}}>
      <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 20px"}}>Your profile</h2>

      <Card style={{marginBottom:14}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"}}>Personal information</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <F label="First name" half><In value={p.firstName} onChange={v=>up("firstName",v)} placeholder="First name"/></F>
          <F label="Last name" half><In value={p.lastName} onChange={v=>up("lastName",v)} placeholder="Last name"/></F>
          <F label="Email" half><In type="email" value={p.email} onChange={v=>up("email",v)} placeholder="your@email.com"/></F>
          <F label="Phone" half><In type="tel" value={p.phone} onChange={v=>up("phone",v)} placeholder="(404) 555-0100"/></F>
          <F label="Date of birth" half><In type="date" value={p.dob} onChange={v=>up("dob",v)}/></F>
          <F label="Nationality" half><In value={p.nationality} onChange={v=>up("nationality",v)} placeholder="United States"/></F>
        </div>
      </Card>

      <Card style={{marginBottom:14}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"}}>Passport (for international travel)</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <F label="Passport number" half><In value={p.passport} onChange={v=>up("passport",v)} placeholder="A12345678"/></F>
          <F label="Expiration date" half><In type="date" value={p.passportExp} onChange={v=>up("passportExp",v)}/></F>
        </div>
      </Card>

      <Card style={{marginBottom:14}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"}}>Travel preferences</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <F label="Seat preference" half>
            <Sel value={p.seat} onChange={v=>up("seat",v)} options={["Window","Aisle","No preference","Exit row"]}/>
          </F>
          <F label="Meal preference" half>
            <Sel value={p.meal} onChange={v=>up("meal",v)} options={["No preference","Vegetarian","Vegan","Halal","Kosher","Gluten-free"]}/>
          </F>
          <F label="Hotel bed preference" half>
            <Sel value={p.hotel} onChange={v=>up("hotel",v)} options={["King bed","Queen bed","Two doubles","No preference"]}/>
          </F>
        </div>
      </Card>

      <Card style={{marginBottom:14}}>
        <p style={{margin:"0 0 14px",fontSize:13,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"}}>Emergency contact</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:12}}>
          <F label="Name" half><In value={p.emergency} onChange={v=>up("emergency",v)} placeholder="Full name"/></F>
          <F label="Phone" half><In type="tel" value={p.emergencyPhone} onChange={v=>up("emergencyPhone",v)} placeholder="(404) 555-0200"/></F>
        </div>
      </Card>

      <Card style={{marginBottom:14}}>
        <p style={{margin:"0 0 10px",fontSize:13,fontWeight:500,textTransform:"uppercase",letterSpacing:"0.07em",color:"var(--color-text-secondary)"}}>Terms of service</p>
        <div ref={tosRef} onScroll={handleTosScroll}
          style={{background:"var(--color-background-secondary)",borderRadius:"var(--border-radius-md)",padding:"12px 14px",height:160,overflow:"auto",fontSize:12,lineHeight:1.8,color:"var(--color-text-secondary)",whiteSpace:"pre-wrap",marginBottom:12,fontFamily:"var(--font-mono)"}}>
          {TOS_TEXT}
        </div>
        {!p.tosRead && <p style={{fontSize:12,color:"var(--color-text-secondary)",marginBottom:10}}>Scroll to the bottom to accept.</p>}
        <label style={{display:"flex",alignItems:"center",gap:10,cursor:p.tosRead?"pointer":"not-allowed",opacity:p.tosRead?1:0.5}}>
          <input type="checkbox" checked={p.tosAccepted} disabled={!p.tosRead} onChange={e=>up("tosAccepted",e.target.checked)} style={{width:16,height:16,accentColor:"#3b0764"}}/>
          <span style={{fontSize:13}}>I have read and agree to the Terms of Service</span>
        </label>
      </Card>

      <Btn variant="primary" onClick={()=>canSave&&setSaved(true)} style={{width:"100%",padding:"12px 20px",fontSize:14,textAlign:"center",opacity:canSave?1:0.5}}>
        <i className="ti ti-check" aria-hidden="true" style={{marginRight:6}}/>Save profile
      </Btn>
    </div>
  );
}

// ─────────────────────── ROOT APP ────────────────────────────────────────────

export default function App() {
  const [mode,setMode] = useState("agent"); // agent | client
  const [agentTab,setAgentTab] = useState("requests"); // requests | builder | sent
  const [clientTab,setClientTab] = useState("request"); // request | profile | quotes
  const [requests,setRequests] = useState(INIT_REQUESTS);
  const [sentQuotes,setSentQuotes] = useState([]);
  const [buildPrefill,setBuildPrefill] = useState(null);

  const handleBuildQuote = (req) => { setBuildPrefill(req); setAgentTab("builder"); };
  const handleQuoteSent  = (q)   => { setSentQuotes(qs=>[q,...qs]); };
  const handleNewRequest = (r)   => { setRequests(rs=>[r,...rs]); };

  const agentTabs = [{id:"requests",icon:"ti-inbox",label:"Requests",badge:requests.filter(r=>r.status==="new").length},{id:"builder",icon:"ti-file-invoice",label:"Quote builder"},{id:"sent",icon:"ti-send",label:"Sent quotes",badge:sentQuotes.length||undefined}];
  const clientTabs = [{id:"request",icon:"ti-plane",label:"Request a trip"},{id:"profile",icon:"ti-user",label:"My profile"},{id:"quotes",icon:"ti-file-dollar",label:"My quotes"}];

  return (
    <div style={{minHeight:"100vh",background:"var(--color-background-tertiary)",fontFamily:"var(--font-sans)"}}>

      {/* Top nav */}
      <div style={{background:"#3b0764",padding:"0 24px",display:"flex",alignItems:"center",height:56,gap:16}}>
        <div style={{display:"flex",alignItems:"center",gap:10,marginRight:"auto"}}>
          <i className="ti ti-plane" aria-hidden="true" style={{fontSize:20,color:"#c4b5fd"}}/>
          <div>
            <span style={{color:"#fff",fontWeight:500,fontSize:14}}>The Real Vacations</span>
            <span style={{color:"#a78bfa",fontSize:11,marginLeft:8}}>Travel Management</span>
          </div>
        </div>
        <div style={{display:"flex",background:"rgba(255,255,255,0.1)",borderRadius:"var(--border-radius-md)",padding:3}}>
          {[["agent","ti-layout-dashboard","Agent portal"],["client","ti-user","Client portal"]].map(([m,ico,lbl])=>(
            <button key={m} onClick={()=>setMode(m)} style={{
              padding:"6px 14px",borderRadius:"var(--border-radius-md)",border:"none",
              background:mode===m?"rgba(255,255,255,0.2)":"transparent",
              color:"#fff",fontSize:12,fontWeight:500,cursor:"pointer",fontFamily:"inherit",
              display:"flex",alignItems:"center",gap:6
            }}>
              <i className={`ti ${ico}`} aria-hidden="true" style={{fontSize:14}}/>{lbl}
            </button>
          ))}
        </div>
      </div>

      <div style={{display:"flex",maxWidth:1060,margin:"0 auto",padding:"24px 20px",gap:20,alignItems:"flex-start"}}>

        {/* Sidebar */}
        <div style={{width:180,flexShrink:0,position:"sticky",top:20}}>
          <div style={{background:"var(--color-background-primary)",border:"0.5px solid var(--color-border-tertiary)",borderRadius:"var(--border-radius-lg)",overflow:"hidden"}}>
            {(mode==="agent"?agentTabs:clientTabs).map(t=>{
              const active = mode==="agent"?agentTab===t.id:clientTab===t.id;
              return (
                <button key={t.id} onClick={()=>mode==="agent"?setAgentTab(t.id):setClientTab(t.id)} style={{
                  width:"100%",padding:"12px 14px",border:"none",borderBottom:"0.5px solid var(--color-border-tertiary)",
                  background:active?"var(--color-background-secondary)":"var(--color-background-primary)",
                  cursor:"pointer",textAlign:"left",fontFamily:"inherit",
                  display:"flex",alignItems:"center",gap:9,
                  color:active?"var(--color-text-primary)":"var(--color-text-secondary)"
                }}>
                  <i className={`ti ${t.icon}`} aria-hidden="true" style={{fontSize:16,flexShrink:0}}/>
                  <span style={{fontSize:13,fontWeight:active?500:400,flex:1}}>{t.label}</span>
                  {t.badge>0 && <span style={{background:"#3b0764",color:"#fff",fontSize:10,fontWeight:500,minWidth:18,height:18,borderRadius:9,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 4px"}}>{t.badge}</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Main content */}
        <div style={{flex:1,minWidth:0}}>
          {mode==="agent" && agentTab==="requests" && <RequestsView requests={requests} onBuildQuote={handleBuildQuote}/>}
          {mode==="agent" && agentTab==="builder"  && <QuoteBuilder prefill={buildPrefill} onSent={handleQuoteSent} allClients={[]}/>}
          {mode==="agent" && agentTab==="sent"     && <SentQuotesView quotes={sentQuotes}/>}
          {mode==="client" && clientTab==="request" && <TripRequestWizard onSubmit={handleNewRequest}/>}
          {mode==="client" && clientTab==="profile" && <ClientProfileView/>}
          {mode==="client" && clientTab==="quotes"  && (
            <div style={{maxWidth:580,margin:"0 auto"}}>
              <h2 style={{fontSize:18,fontWeight:500,margin:"0 0 20px"}}>My quotes</h2>
              {sentQuotes.length===0
                ? <Card><p style={{color:"var(--color-text-secondary)",textAlign:"center",padding:32}}>No quotes yet. Submit a trip request and your agent will send you a personalized quote.</p></Card>
                : sentQuotes.map(q=>(
                    <Card key={q.id} style={{marginBottom:10}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <p style={{margin:"0 0 4px",fontWeight:500}}>{q.destination||"Your trip"}</p>
                          <p style={{margin:0,fontSize:12,color:"var(--color-text-secondary)"}}>Sent {q.date} · From {q.agent}</p>
                        </div>
                        <div style={{textAlign:"right"}}>
                          <p style={{margin:0,fontSize:20,fontWeight:500}}>{fmtMoney(q.clientTotal)}</p>
                          {q.bookLink && <a href={q.bookLink} style={{fontSize:12,color:"#3b0764",fontWeight:500}}>Book now →</a>}
                        </div>
                      </div>
                    </Card>
                  ))
              }
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
