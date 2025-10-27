import React, { useState } from 'react'

const API = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function App(){
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [token, setToken] = useState(localStorage.getItem('token')||'')
  const [apiKey, setApiKey] = useState(localStorage.getItem('apiKey')||'')
  const [file, setFile] = useState(null)
  const [status, setStatus] = useState('')

  async function signup(e){
    e.preventDefault()
    const res = await fetch(API + '/api/auth/signup', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password })
    })
    const j = await res.json()
    if(res.ok){ setToken(j.token); setApiKey(j.apiKey); localStorage.setItem('token', j.token); localStorage.setItem('apiKey', j.apiKey); setStatus('Signed up') }
    else setStatus(j.error||'Signup failed')
  }

  async function login(e){
    e.preventDefault()
    const res = await fetch(API + '/api/auth/login', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password })
    })
    const j = await res.json()
    if(res.ok){ setToken(j.token); setApiKey(j.apiKey); localStorage.setItem('token', j.token); localStorage.setItem('apiKey', j.apiKey); setStatus('Logged in') }
    else setStatus(j.error||'Login failed')
  }

  function pick(e){ setFile(e.target.files[0]); setStatus('') }

  async function callApi(path, fieldName='file', extra={}){
    if(!file) return alert('Choose file')
    setStatus('Processing...')
    const fd = new FormData()
    fd.append(fieldName, file)
    Object.keys(extra).forEach(k=>fd.append(k, extra[k]))
    const res = await fetch(API + path, { method:'POST', body: fd, headers: { 'x-api-key': apiKey } })
    if(!res.ok){ const txt=await res.text(); setStatus('Error'); alert(txt); return }
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'result'; a.click();
    setStatus('Done')
  }

  return (
    <div className="min-h-screen p-6">
      <header className="max-w-4xl mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">PDF<span className="text-pink-500">Love</span>Me</h1>
        <div>
          <div className="text-xs">API Key: <span className="font-mono">{apiKey||'—'}</span></div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto mt-6 bg-white p-6 rounded-xl shadow">
        <form className="flex gap-2" onSubmit={signup}>
          <input className="border p-2" placeholder="email" value={email} onChange={e=>setEmail(e.target.value)} />
          <input className="border p-2" placeholder="password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
          <button className="px-3 py-2 bg-indigo-600 text-white rounded" onClick={signup}>Sign up</button>
          <button className="px-3 py-2 bg-slate-200 rounded" onClick={login}>Login</button>
        </form>

        <div className="mt-4">
          <input type="file" accept="application/pdf" onChange={pick} />
          <div className="mt-2 flex gap-2">
            <button onClick={()=>callApi('/api/merge','files')} className="px-3 py-2 rounded bg-indigo-600 text-white">Merge</button>
            <button onClick={()=>callApi('/api/split')} className="px-3 py-2 rounded bg-indigo-50 border">Split</button>
            <button onClick={()=>callApi('/api/compress')} className="px-3 py-2 rounded bg-indigo-50 border">Compress</button>
            <button onClick={()=>callApi('/api/convert','file',{target:'docx'})} className="px-3 py-2 rounded bg-indigo-50 border">Convert</button>
            <button onClick={()=>callApi('/api/sign')} className="px-3 py-2 rounded bg-pink-500 text-white">Sign</button>
          </div>
        </div>
        <div className="mt-4 text-sm text-slate-500">Status: {status}</div>
      </main>
    </div>
  )
}
