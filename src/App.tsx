import { useEffect, useMemo, useState } from 'react'
import { buildPositions } from './data/mockData'
import { getInventory } from './services/api'
import type { Box, Sample } from './types'

const defaultBoxes: Box[] = []
const defaultSamples: Sample[] = []

export default function App(){
  const [stripe,setStripe]=useState('')
  const [boxId,setBoxId]=useState('')
  const [selectedPosition,setSelectedPosition]=useState<string|null>(null)
  const [boxes,setBoxes]=useState<Box[]>(defaultBoxes)
  const [samples,setSamples]=useState<Sample[]>(defaultSamples)
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState('')
  const stripes=Array.from(new Set(boxes.map(box=>box.stripeId)))
  const availableBoxes=boxes.filter(box=>box.stripeId===stripe)
  const activeBox=boxes.find(box=>box.id===boxId)??availableBoxes[0]
  const positions=useMemo(()=>activeBox?buildPositions(activeBox,samples):[],[activeBox])
  const selected=positions.find(position=>position.id===selectedPosition)
  const selectedSample=selected?.sampleId?samples.find(sample=>sample.id===selected.sampleId):undefined

  useEffect(()=>{ getInventory().then(data=>{ setSamples(data.samples); setBoxes(data.boxes); const firstStripe=data.boxes[0]?.stripeId || ''; setStripe(firstStripe); setBoxId(data.boxes[0]?.id || ''); }).catch(err=>setError(err instanceof Error ? err.message : 'Unable to load inventory')).finally(()=>setLoading(false)) },[])

  function changeStripe(value:string){
    setStripe(value)
    const nextBox=boxes.find(box=>box.stripeId===value)
    if(nextBox)setBoxId(nextBox.id)
    setSelectedPosition(null)
  }

  if(loading) return <div className="loading-screen">Loading inventory…</div>
  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark">Y</div><div><strong>YAS LAB</strong><span>Cryogenic Inventory</span></div></div>
      <nav><a className="nav-item active" href="#map">Storage Map</a><a className="nav-item" href="#samples">Samples</a><a className="nav-item" href="#activity">Activity Log</a></nav>
      <div className="sidebar-footer">Phase 1 · Foundation</div>
    </aside>
    <main className="main">
      <header className="topbar"><div><p className="eyebrow">Inventory</p><h1>Storage Map</h1>{error&&<p className="error-message">Backend: {error}</p>}</div><button className="button primary">+ Add Sample</button></header>
      <section className="toolbar">
        <label><span>Stripe</span><select value={stripe} onChange={event=>changeStripe(event.target.value)}>{stripes.map(item=><option key={item}>{item}</option>)}</select></label>
        <label><span>Box</span><select value={activeBox?.id} onChange={event=>{setBoxId(event.target.value);setSelectedPosition(null)}}>{availableBoxes.map(box=><option key={box.id} value={box.id}>{box.name}</option>)}</select></label>
        <div className="toolbar-spacer"/>
        <div className="legend"><span><i className="dot occupied"/> Occupied</span><span><i className="dot empty"/> Empty</span></div>
      </section>
      <section className="content-grid" id="map">
        <div className="card map-card">
          <div className="card-header"><div><h2>{activeBox?.name}</h2><p>{activeBox?.id} · 81 positions</p></div><span className="capacity">{positions.filter(p=>p.occupied).length} / {positions.length} occupied</span></div>
          <div className="map"><div className="corner"/>{activeBox?.columns.map(column=><div className="axis" key={column}>{column}</div>)}{Array.from({length:9},(_,rowIndex)=><div className="map-row" key={rowIndex}><div className="axis">{rowIndex+1}</div>{activeBox?.columns.map(column=>{const position=positions.find(p=>p.column===column&&p.row===rowIndex+1)!;return <button key={position.id} className={`position ${position.occupied?'occupied':'empty'} ${selectedPosition===position.id?'selected':''}`} onClick={()=>setSelectedPosition(position.id)} title={position.id}>{position.occupied?'●':''}</button>})}</div>)}</div>
        </div>
        <aside className="card detail-card">
          {!selected?<div className="empty-detail"><div className="detail-icon">+</div><h3>Select a position</h3><p>Click any position on the map to view its sample or add a new one.</p></div>:selectedSample?<><div className="card-header"><div><p className="eyebrow">Position</p><h2>{selected.id}</h2></div><span className="status passed">{selectedSample.qcStatus}</span></div><dl className="details">{[['Sample ID',selectedSample.id],['Cell Line',selectedSample.cellLine],['Sample Type',selectedSample.sampleType],['Passage',selectedSample.passage??'—'],['Owner',selectedSample.owner],['Notes',selectedSample.notes||'—']].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><div className="detail-actions"><button className="button">Edit Sample</button><button className="button">Move</button></div></>:<><p className="eyebrow">Empty position</p><h2>{selected.id}</h2><p className="muted">This position is available for a new sample.</p><button className="button primary full">+ Add Sample Here</button></>}
        </aside>
      </section>
    </main>
  </div>
}