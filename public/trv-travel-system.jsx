{(type==="full"||type==="flights"||type==="corporate") && (
  <>
    <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
      <F label="Flying from" half>
        <In
          value={details.from}
          onChange={v=>ud("from",v)}
          placeholder="ATL, TPA..."
        />
      </F>

      <F label="Flying to" half>
        <In
          value={details.to}
          onChange={v=>ud("to",v)}
          placeholder="CTG, MIA..."
        />
      </F>

      <F label="Depart" half>
        <In
          type="date"
          value={details.depart}
          onChange={v=>ud("depart",v)}
        />
      </F>

      <F label="Return" half>
        <In
          type="date"
          value={details.return}
          onChange={v=>ud("return",v)}
        />
      </F>

      <F label="Travelers" half>
        <In
          type="number"
          value={details.passengers}
          onChange={v=>ud("passengers",v)}
          placeholder="1"
        />
      </F>

      <F label="Cabin class" half>
        <Sel
          value={details.cabin}
          onChange={v=>ud("cabin",v)}
          options={[
            "Economy",
            "Premium Economy",
            "Business",
            "First Class"
          ]}
        />
      </F>
    </div>
  </>
)}
